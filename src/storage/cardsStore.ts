import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { Card } from "../cards/types.js";

export class CardsStore {
  constructor(private readonly workspaceRoot: string) {}

  async readCards(): Promise<Card[]> {
    try {
      const filePath = this.getCollectionPath();
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

  async addCards(cards: Card[]): Promise<{ added: Card[]; skipped: number }> {
    const existing = await this.readCards();
    const existingHashes = new Set(existing.map(hashCard));

    const added: Card[] = [];
    for (const card of cards) {
      const sanitized = sanitizeCard(card);
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

  private async writeCards(cards: Card[]): Promise<void> {
    const filePath = this.getCollectionPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cards, null, 2), "utf8");
  }

  private getCollectionPath(): string {
    return path.join(
      this.workspaceRoot,
      ".vscode",
      "knowledge-cards.json"
    );
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
