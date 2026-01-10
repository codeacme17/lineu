import type { EditorType } from "./vscode-bridge.js";

/**
 * Auto-detect which editor is running based on environment variables.
 */
export function detectEditor(): EditorType {
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? "";

  if (termProgram.includes("cursor")) return "cursor";
  if (termProgram.includes("vscode") || termProgram.includes("code"))
    return "vscode";
  if (termProgram.includes("vscodium")) return "vscodium";
  if (termProgram.includes("windsurf")) return "windsurf";

  // Check for editor-specific env vars
  if (process.env.CURSOR_CHANNEL) return "cursor";
  if (process.env.VSCODE_GIT_IPC_HANDLE || process.env.VSCODE_IPC_HOOK)
    return "vscode";

  // Default to vscode as it's most common
  return "vscode";
}
