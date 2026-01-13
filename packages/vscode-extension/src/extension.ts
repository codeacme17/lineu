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
let cardsViewProvider: CardsViewProvider | null = null;
let contextWatcher: fs.FSWatcher | null = null;

const CONTEXT_DIR = path.join(os.homedir(), ".lineu");
const PENDING_CONTEXTS_FILE = path.join(CONTEXT_DIR, "pending-contexts.json");

export function activate(context: vscode.ExtensionContext) {
  // Register URI handler for MCP server to push context
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      if (uri.path === "/capture") {
        const params = new URLSearchParams(uri.query);
        const filePath = params.get("file");
        if (filePath) {
          handleIncomingContext(filePath);
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
        const contextText = await getContextText(selectionText);
        const diffText = await getGitDiff(workspaceRoot);

        const cards = generateCards({
          contextText,
          diffText,
          selectionText,
        });

        const store = new CardsStore(workspaceRoot);
        showCardsWebview({
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

  const copyMcpServerPath = vscode.commands.registerCommand(
    "cards.copyMcpServerPath",
    async () => {
      const serverPath = getEmbeddedMcpServerPath(context.extensionPath);
      if (!serverPath) {
        vscode.window.showErrorMessage(
          "Embedded MCP server not found. Run the extension build first."
        );
        return;
      }
      await vscode.env.clipboard.writeText(serverPath);
      vscode.window.showInformationMessage("MCP server path copied.");
    }
  );

  const copyMcpConfig = vscode.commands.registerCommand(
    "cards.copyMcpConfig",
    async () => {
      const serverPath = getEmbeddedMcpServerPath(context.extensionPath);
      if (!serverPath) {
        vscode.window.showErrorMessage(
          "Embedded MCP server not found. Run the extension build first."
        );
        return;
      }

      const target = await vscode.window.showQuickPick(
        [
          { label: "Cursor", id: "cursor" },
          { label: "Claude Desktop", id: "claude-desktop" },
          { label: "Windsurf", id: "windsurf" },
          { label: "Generic MCP config", id: "generic" },
        ],
        {
          placeHolder: "Select where to use the MCP config",
        }
      );

      if (!target) {
        return;
      }

      const config = buildMcpConfigSnippet(serverPath);
      await vscode.env.clipboard.writeText(config);
      vscode.window.showInformationMessage(
        `MCP config snippet copied for ${target.label}.`
      );
    }
  );

  // 注册侧边栏视图
  cardsViewProvider = new CardsViewProvider(context.extensionUri);
  const cardsViewRegistration = vscode.window.registerWebviewViewProvider(
    "cards.sidebar",
    cardsViewProvider
  );
  context.subscriptions.push(
    uriHandler,
    captureCommand,
    openCollection,
    configureOpenRouter,
    copyMcpServerPath,
    copyMcpConfig,
    cardsViewRegistration
  );

  // 启动文件监听
  startContextWatcher(context);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cards.processPendingContexts",
      () => processPendingContexts()
    )
  );

  // 激活时检查待处理上下文
  setTimeout(processPendingContexts, 1000);
}

export function deactivate() {
  contextWatcher?.close();
  contextWatcher = null;
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

async function getContextText(selectionText?: string): Promise<string> {
  const promptText = await vscode.window.showInputBox({
    prompt: "Enter context for card generation",
    placeHolder: "e.g. Debugging auth token refresh issue...",
    value: selectionText ?? "",
    ignoreFocusOut: true,
  });
  if (promptText === undefined) {
    return selectionText ?? "";
  }
  return promptText.trim();
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

function showCardsWebview(options: {
  cards: Card[];
  mode: "deal" | "collection";
  onFavorite?: (card: Card) => Promise<void>;
}): void {
  if (!cardsViewProvider) {
    return;
  }
  cardsViewProvider.update(options.cards, options.mode, options.onFavorite);
  cardsViewProvider.reveal();
  vscode.commands.executeCommand("workbench.view.extension.cardsView");
}

async function processPendingContexts(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return;
  }

  let fileData: string | undefined;
  try {
    fileData = await readFile(PENDING_CONTEXTS_FILE, "utf-8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    console.error("Failed to read pending contexts:", error);
    return;
  }

  if (!fileData) {
    return;
  }

  const parsed = safeJsonParse(fileData);
  const contexts = normalizePendingContexts(parsed);
  if (contexts.length === 0) {
    return;
  }

  const unprocessed = contexts.filter((item) => !item.processed);
  if (unprocessed.length === 0) {
    return;
  }

  const cards = unprocessed.flatMap((item) =>
    generateCards({
      contextText: item.conversationText ?? "",
      diffText: item.diff ?? "",
      selectionText: item.selection ?? "",
      type: item.type,
    })
  );

  if (cards.length === 0) {
    return;
  }

  const store = new CardsStore(workspaceRoot);
  showCardsWebview({
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

  try {
    const updated = contexts.map((item) =>
      item.processed ? item : { ...item, processed: true }
    );
    await fs.promises.writeFile(
      PENDING_CONTEXTS_FILE,
      JSON.stringify(updated, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Failed to update pending contexts:", error);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getEmbeddedMcpServerPath(extensionPath: string): string | null {
  const serverPath = path.join(extensionPath, "mcp-server", "dist", "index.js");
  return fs.existsSync(serverPath) ? serverPath : null;
}

function buildMcpConfigSnippet(serverPath: string): string {
  const snippet = {
    mcpServers: {
      "lineu-cards": {
        command: "node",
        args: [serverPath],
      },
    },
  };
  return JSON.stringify(snippet, null, 2);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

type PendingContext = {
  conversationText?: string;
  diff?: string;
  selection?: string;
  metadata?: Record<string, unknown>;
  type?: "bug" | "best_practice" | "knowledge";
  processed?: boolean;
};

function normalizePendingContexts(data: unknown): PendingContext[] {
  if (Array.isArray(data)) {
    return data as PendingContext[];
  }
  if (!data || typeof data !== "object") {
    return [];
  }
  const record = data as Record<string, unknown>;
  const candidateKeys = [
    "pendingContexts",
    "pending",
    "contexts",
    "items",
  ];
  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value as PendingContext[];
    }
  }
  return [];
}
