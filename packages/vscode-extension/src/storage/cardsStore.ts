import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import type { Card } from "@lineu/lib";

/**
 * Global cards storage at ~/.lineu/{project}/cards.json
 * Each project has its own folder to avoid JSON bloat
 */
export class CardsStore {
  private readonly projectName: string;

  constructor(private readonly workspaceRoot: string) {
    this.projectName = path.basename(workspaceRoot);
  }

  /** Read cards for current project */
  async readCards(): Promise<Card[]> {
    try {
      const filePath = this.getProjectStoragePath();
      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as Card[]) : [];
    } catch (error) {
      if (isFileMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  /** Get all project names that have cards */
  async getProjects(): Promise<string[]> {
    try {
      const baseDir = this.getBaseStoragePath();
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const projects: string[] = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if cards.json exists in this folder
          const cardsPath = path.join(baseDir, entry.name, "cards.json");
          try {
            await fs.access(cardsPath);
            projects.push(entry.name);
          } catch {
            // No cards.json, skip
          }
        }
      }
      
      return projects;
    } catch (error) {
      if (isFileMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  async addCards(cards: Card[]): Promise<{ added: Card[]; skipped: number }> {
    const existing = await this.readCards();
    const existingHashes = new Set(existing.map(hashCard));

    const added: Card[] = [];
    for (const card of cards) {
      const sanitized = sanitizeCard(card);
      sanitized.project = this.projectName;
      const hash = hashCard(sanitized);
      if (existingHashes.has(hash)) {
        continue;
      }
      existingHashes.add(hash);
      added.push(sanitized);
    }

    if (added.length > 0) {
      const updated = [...existing, ...added];
      await this.writeCards(updated);
    }

    return {
      added,
      skipped: cards.length - added.length,
    };
  }

  async deleteCard(cardId: string): Promise<boolean> {
    const existing = await this.readCards();
    const filtered = existing.filter((c) => c.id !== cardId);
    if (filtered.length === existing.length) {
      return false;
    }
    await this.writeCards(filtered);
    return true;
  }

  private async writeCards(cards: Card[]): Promise<void> {
    const filePath = this.getProjectStoragePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cards, null, 2), "utf8");
  }

  private getBaseStoragePath(): string {
    return path.join(os.homedir(), ".lineu");
  }

  private getProjectStoragePath(): string {
    return path.join(this.getBaseStoragePath(), this.projectName, "cards.json");
  }

  /** Get project name */
  getProjectName(): string {
    return this.projectName;
  }
}

function hashCard(card: Card): string {
  const codeRefPaths = card.codeRefs?.map((ref) => ref.path).join("|") ?? "";
  const raw = `${card.title}|${card.summary}|${codeRefPaths}`;
  return createHash("sha256").update(raw).digest("hex");
}

function sanitizeCard(card: Card): Card {
  return {
    ...card,
    title: sanitizeText(card.title),
    summary: sanitizeText(card.summary),
  };
}

function sanitizeText(text: string): string {
  let sanitized = text;
  const patterns: RegExp[] = [
    /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-]{6,}["']?/gi,
    /secret\s*[:=]\s*["']?[A-Za-z0-9_\-]{6,}["']?/gi,
    /BEGIN PRIVATE KEY[\s\S]*?END PRIVATE KEY/gi,
  ];
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, "***");
  }
  return sanitized;
}

function isFileMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
