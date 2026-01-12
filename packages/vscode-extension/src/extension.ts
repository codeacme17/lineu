import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";

import { generateCards, Card } from "@lineu/lib";
import { CardsStore } from "./storage/cardsStore.js";
import { CardsViewProvider } from "./ui/webview.js";

const execAsync = promisify(exec);

let mcpClient: McpClient | null = null;
let extensionContext: vscode.ExtensionContext | null = null;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Register URI handler for MCP server to push context
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      if (uri.path === "/capture") {
        const params = new URLSearchParams(uri.query);
        const filePath = params.get("file");
        if (filePath) {
          handleIncomingContext(context, filePath);
        }
      }
    },
  });

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

  // 注册侧边栏视图
  cardsViewProvider = new CardsViewProvider(context.extensionUri);
  context.subscriptions.push(
    uriHandler,
    captureCommand,
    openCollection,
    configureOpenRouter
  );

  // 启动文件监听
  startContextWatcher(context);

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand("cards.captureContextAndGenerate", handleCapture),
    vscode.commands.registerCommand("cards.openCollection", handleOpenCollection),
    vscode.commands.registerCommand("cards.processPendingContexts", () => processPendingContexts())
  );

  // 激活时检查待处理上下文
  setTimeout(processPendingContexts, 1000);
}

export function deactivate() {
  contextWatcher?.close();
  contextWatcher = null;
}

// ============ 命令处理 ============

async function handleCapture() {
  const workspaceRoot = requireWorkspace();
  if (!workspaceRoot) return;

  const contextText = await vscode.window.showInputBox({
    prompt: "Enter context for card generation",
    placeHolder: "e.g. Debugging auth token refresh issue...",
  });
  if (!contextText) return;

  const cards = generateCards({
    contextText,
    diffText: await getGitDiff(workspaceRoot),
    selectionText: getSelectionText(),
  });

  await showCards(cards, workspaceRoot);
}

async function handleOpenCollection() {
  const workspaceRoot = requireWorkspace();
  if (!workspaceRoot) return;

  const store = new CardsStore(workspaceRoot);
  const cards = await store.readCards();
  cardsViewProvider?.update(cards, "collection");
  await vscode.commands.executeCommand("workbench.view.extension.cardsView");
}

// ============ MCP 上下文处理 ============

function startContextWatcher(context: vscode.ExtensionContext): void {
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  try {
    contextWatcher = fs.watch(CONTEXT_DIR, (_, filename) => {
      if (filename === "pending-contexts.json") {
        setTimeout(processPendingContexts, 500);
      }
    });

    context.subscriptions.push({
      dispose: () => {
        contextWatcher?.close();
        contextWatcher = null;
      },
    });
  } catch (error) {
    console.error("Failed to start context watcher:", error);
  }
}

/**
 * Handle incoming context from MCP server via URI handler.
 * The MCP server writes context to a temp file and triggers this URI.
 */
async function handleIncomingContext(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<void> {
  try {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("Open a workspace to receive cards.");
      return;
    }

    // Read context from temp file
    const content = await readFile(filePath, "utf-8");
    const incomingContext = JSON.parse(content) as {
      conversationText?: string;
      diff?: string;
      selection?: string;
      metadata?: Record<string, unknown>;
      type?: "bug" | "best_practice" | "knowledge";
    };

    // Generate cards from incoming context
    const cards = generateCards({
      contextText: incomingContext.conversationText || "",
      diffText: incomingContext.diff || "",
      selectionText: incomingContext.selection || "",
      type: incomingContext.type,
    });

    if (cards.length === 0) {
      vscode.window.showInformationMessage("No cards generated from context.");
      return;
    }

    // Show cards in webview
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

    vscode.window.showInformationMessage(
      `Received ${cards.length} card(s) from vibe-coding session.`
    );

    // Cleanup temp file
    try {
      await unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to process incoming context: ${formatError(error)}`
    );
  }
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getSelectionText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  return editor.document.getText(editor.selection).trim();
}

async function getGitDiff(workspaceRoot: string): Promise<string> {
  const diffMode = vscode.workspace.getConfiguration("cards").get<string>("diffMode", "unstaged");
  const commands: string[] = [];

  if (diffMode === "unstaged" || diffMode === "both") commands.push("git diff");
  if (diffMode === "staged" || diffMode === "both") commands.push("git diff --staged");

  if (commands.length === 0) return "";

  try {
    const results = await Promise.all(
      commands.map((cmd) => execAsync(cmd, { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 }))
    );
    return results.map((r) => r.stdout).join("\n");
  } catch {
    return "";
  }
}
