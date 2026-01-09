import * as vscode from "vscode";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { generateCards } from "@lineu/lib";
import { McpClient } from "./mcp/client.js";
import { CardsStore } from "./storage/cardsStore.js";
import { showCardsWebview } from "./ui/webview.js";

const execAsync = promisify(exec);

let mcpClient: McpClient | null = null;

export function activate(context: vscode.ExtensionContext) {
  const captureCommand = vscode.commands.registerCommand(
    "cards.captureContextAndGenerate",
    async () => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("Open a workspace to capture cards.");
          return;
        }

        const selectionText = getSelectionText();
        const contextText = await getContextText(
          context,
          workspaceRoot,
          selectionText
        );
        const diffText = await getGitDiff(workspaceRoot);

        const cards = generateCards({
          contextText,
          diffText,
          selectionText,
        });

        const store = new CardsStore(workspaceRoot);
        showCardsWebview({
          extensionUri: context.extensionUri,
          cards,
          mode: "deal",
          onFavorite: async (card) => {
            const result = await store.addCards([card]);
            if (result.added.length > 0) {
              vscode.window.showInformationMessage("Card saved.");
            } else {
              vscode.window.showInformationMessage("Card already saved.");
            }
          },
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate cards: ${formatError(error)}`
        );
      }
    }
  );

  const openCollection = vscode.commands.registerCommand(
    "cards.openCollection",
    async () => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("Open a workspace to view cards.");
          return;
        }

        const store = new CardsStore(workspaceRoot);
        const cards = await store.readCards();
        showCardsWebview({
          extensionUri: context.extensionUri,
          cards,
          mode: "collection",
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open collection: ${formatError(error)}`
        );
      }
    }
  );

  const configureOpenRouter = vscode.commands.registerCommand(
    "cards.configureOpenRouterApiKey",
    async () => {
      try {
        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your OpenRouter API key.",
          password: true,
          ignoreFocusOut: true,
          placeHolder: "sk-or-...",
        });

        if (!apiKey) {
          return;
        }

        await context.secrets.store("cards.openRouterApiKey", apiKey.trim());
        vscode.window.showInformationMessage("OpenRouter API key saved.");
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to store OpenRouter API key: ${formatError(error)}`
        );
      }
    }
  );

  context.subscriptions.push(
    captureCommand,
    openCollection,
    configureOpenRouter
  );
}

export async function deactivate() {
  try {
    await mcpClient?.dispose();
  } catch {
    // Best effort cleanup.
  }
}

function getWorkspaceRoot(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  return workspaceFolder?.uri.fsPath;
}

function getSelectionText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }

  return editor.document.getText(selection).trim();
}

async function getContextText(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  selectionText?: string
): Promise<string> {
  const seedText = selectionText ? selectionText : "";
  try {
    if (!mcpClient) {
      mcpClient = new McpClient(context, workspaceRoot);
    }
    const mcpContext = await mcpClient.captureContext({
      seedText,
      recentInputs: [],
      metadata: {
        workspace: path.basename(workspaceRoot),
      },
    });
    return mcpContext.conversationText || "";
  } catch (error) {
    vscode.window.showErrorMessage(
      `MCP unavailable, please enter context manually. (${formatError(error)})`
    );
    const fallback = await vscode.window.showInputBox({
      prompt: "Enter a short context snippet for the cards.",
      placeHolder: "e.g. Fixing auth token refresh flow",
    });
    return fallback ?? "";
  }
}

async function getGitDiff(workspaceRoot: string): Promise<string> {
  const config = vscode.workspace.getConfiguration("cards");
  const diffMode = config.get<string>("diffMode", "unstaged");
  const commands: string[] = [];

  if (diffMode === "unstaged" || diffMode === "both") {
    commands.push("git diff");
  }
  if (diffMode === "staged" || diffMode === "both") {
    commands.push("git diff --staged");
  }

  if (commands.length === 0) {
    return "";
  }

  try {
    const diffs = await Promise.all(
      commands.map(async (cmd) => {
        const result = await execAsync(cmd, {
          cwd: workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        });
        return result.stdout;
      })
    );
    return diffs.join("\n");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Git diff unavailable, continuing without diff. (${formatError(error)})`
    );
    return "";
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
