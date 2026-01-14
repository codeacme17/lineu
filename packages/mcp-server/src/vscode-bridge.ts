import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Supported editors with their URI schemes.
 */
export type EditorType = "cursor" | "vscode" | "vscodium" | "windsurf";

const EDITOR_SCHEMES: Record<EditorType, string> = {
  cursor: "cursor",
  vscode: "vscode",
  vscodium: "vscodium",
  windsurf: "windsurf",
};

/**
 * Context payload to send to VSCode extension.
 */
export interface VSCodeContext {
  /** Action type: create new card, or replace existing with respark/deepspark */
  action?: "create" | "respark" | "deepspark";
  /** Card ID to replace (for respark/deepspark) */
  cardId?: string;
  conversationText: string;
  /** Full conversation history for respark/deepspark. Stored but not displayed. */
  rawConversation?: string;
  diff?: string;
  selection?: string;
  metadata?: Record<string, unknown>;
  type?: "bug" | "best_practice" | "knowledge";
}

/**
 * Options for pushing context.
 */
export interface PushOptions {
  editor?: EditorType;
}

/**
 * Result of pushing context to VSCode.
 */
export interface PushResult {
  success: boolean;
  error?: string;
  tempFile?: string;
  editor?: EditorType;
}

/**
 * Push context to editor extension via URI handler.
 *
 * This writes the context to a temp file and triggers the
 * {editor}://lineu.lineu/capture URI.
 *
 * @param context - The context to push
 * @param options - Options including which editor to target (defaults to "cursor")
 */
export async function pushToVSCode(
  context: VSCodeContext,
  options: PushOptions = {}
): Promise<PushResult> {
  const editor = options.editor ?? "cursor";
  const scheme = EDITOR_SCHEMES[editor] ?? "cursor";

  try {
    // Write context to temp file
    const tempFile = join(tmpdir(), `lineu-context-${randomUUID()}.json`);
    await writeFile(tempFile, JSON.stringify(context, null, 2), "utf-8");

    // Build URI with file path
    const uri = `${scheme}://lineu.lineu/capture?file=${encodeURIComponent(tempFile)}`;

    // Platform-specific open command
    const openCmd = getOpenCommand(uri);

    return new Promise((resolve) => {
      exec(openCmd, { timeout: 5000 }, (error) => {
        if (error) {
          resolve({
            success: false,
            error: `Failed to open ${editor} URI: ${error.message}`,
            tempFile,
            editor,
          });
        } else {
          resolve({
            success: true,
            tempFile,
            editor,
          });
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      editor,
    };
  }
}

/**
 * Get platform-specific command to open a URI.
 */
function getOpenCommand(uri: string): string {
  switch (process.platform) {
    case "darwin":
      return `open "${uri}"`;
    case "win32":
      return `start "" "${uri}"`;
    default:
      // Linux and other Unix-like systems
      return `xdg-open "${uri}"`;
  }
}
