import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { generateCards, Card } from "@lineu/lib";
import { CardsStore } from "./storage/cardsStore.js";
import { CardsViewProvider } from "./ui/webview.js";

const execAsync = promisify(exec);

// 共享上下文文件路径 - 与 MCP Server 保持一致
const CONTEXT_DIR = path.join(os.homedir(), ".lineu");
const CONTEXT_FILE = path.join(CONTEXT_DIR, "pending-contexts.json");

// 与 MCP Server 的 CapturedContext 类型保持一致
type CapturedContext = {
  id: string;
  conversationText: string;
  recentInputs: string[];
  metadata: Record<string, unknown>;
  timestamp: string;
  processed: boolean;
};

let cardsViewProvider: CardsViewProvider | null = null;
let contextWatcher: fs.FSWatcher | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log("🎴 Knowledge Cards extension activated!");

  // 注册侧边栏视图
  cardsViewProvider = new CardsViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("cards.sidebar", cardsViewProvider)
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

async function processPendingContexts(): Promise<void> {
  if (!fs.existsSync(CONTEXT_FILE)) return;

  try {
    const contexts: CapturedContext[] = JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));
    const pending = contexts.filter((c) => !c.processed);
    if (pending.length === 0) return;

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return;

    const diffText = await getGitDiff(workspaceRoot);
    const allCards: Card[] = [];

    for (const ctx of pending) {
      const contextText = [ctx.conversationText, ...(ctx.recentInputs || [])]
        .filter(Boolean)
        .join("\n\n");

      allCards.push(...generateCards({ contextText, diffText, selectionText: undefined }));
      ctx.processed = true;
    }

    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(contexts, null, 2), "utf8");

    if (allCards.length > 0) {
      await showCards(allCards, workspaceRoot);
      vscode.window.showInformationMessage(
        `Generated ${allCards.length} card(s) from ${pending.length} AI conversation(s).`
      );
    }
  } catch (error) {
    console.error("Failed to process pending contexts:", error);
  }
}

// ============ 工具函数 ============

async function showCards(cards: Card[], workspaceRoot: string) {
  const store = new CardsStore(workspaceRoot);
  cardsViewProvider?.update(cards, "deal", async (card) => {
    const result = await store.addCards([card]);
    vscode.window.showInformationMessage(
      result.added.length > 0 ? "Card saved." : "Card already saved."
    );
  });
  await vscode.commands.executeCommand("workbench.view.extension.cardsView");
}

function requireWorkspace(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("Open a workspace first.");
  }
  return root;
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
