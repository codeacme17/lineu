import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import type { Card } from "./types/card.js";

/**
 * Get the base storage directory: ~/.lineu
 */
export function getBaseStoragePath(): string {
  return path.join(os.homedir(), ".lineu");
}

/**
 * Get project name from a workspace path, or "global" if not provided
 */
export function getProjectName(workspacePath?: string): string {
  if (!workspacePath) return "global";
  return path.basename(workspacePath);
}

/**
 * Get the inbox file path for a project: ~/.lineu/{project}/inbox.json
 * This is where MCP writes new cards (replaced on each spark)
 */
export function getInboxPath(projectName: string): string {
  return path.join(getBaseStoragePath(), projectName, "inbox.json");
}

/**
 * Get the cards file path for a project: ~/.lineu/{project}/cards.json
 * This is where saved cards are stored (never overwritten by MCP)
 */
export function getCardsPath(projectName: string): string {
  return path.join(getBaseStoragePath(), projectName, "cards.json");
}

/**
 * Read cards from a JSON file
 */
export async function readCardsFile(filePath: string): Promise<Card[]> {
  try {
    const data = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (isFileMissing(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Write cards to a JSON file (creates directory if needed)
 */
export async function writeCardsFile(
  filePath: string,
  cards: Card[]
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(cards, null, 2), "utf8");
}

/**
 * Generate a hash for deduplication
 */
export function hashCard(card: Card): string {
  const codeRefPaths = card.codeRefs?.map((ref) => ref.path).join("|") ?? "";
  const raw = `${card.title}|${card.summary}|${codeRefPaths}`;
  return createHash("sha256").update(raw).digest("hex");
}

function isFileMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
