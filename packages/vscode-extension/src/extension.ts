import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { generateCards } from "@lineu/lib";
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
  vscode.window.showInformationMessage("Knowledge Cards extension is ready!");

  // 注册侧边栏视图
  cardsViewProvider = new CardsViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("cards.sidebar", cardsViewProvider)
  );

  // 启动文件监听 - 监听 MCP Server 写入的上下文
  startContextWatcher(context);

  // 命令：手动捕获上下文并生成卡片
  const captureCommand = vscode.commands.registerCommand(
    "cards.captureContextAndGenerate",
    async () => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("Open a workspace to capture cards.");
          return;
        }

        // 手动输入上下文
        const contextText = await vscode.window.showInputBox({
          prompt: "Enter context for card generation",
          placeHolder: "e.g. Debugging auth token refresh issue...",
        });

        if (!contextText) {
          return;
        }

        const selectionText = getSelectionText();
        const diffText = await getGitDiff(workspaceRoot);

        const cards = generateCards({
          contextText,
          diffText,
          selectionText,
        });

        const store = new CardsStore(workspaceRoot);
        cardsViewProvider?.update(cards, "deal", async (card) => {
          const result = await store.addCards([card]);
          if (result.added.length > 0) {
            vscode.window.showInformationMessage("Card saved.");
          } else {
            vscode.window.showInformationMessage("Card already saved.");
          }
        });
        await vscode.commands.executeCommand("workbench.view.extension.cardsView");
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate cards: ${formatError(error)}`
        );
      }
    }
  );

  // 命令：打开收藏的卡片集合
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
        cardsViewProvider?.update(cards, "collection");
        await vscode.commands.executeCommand("workbench.view.extension.cardsView");
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open collection: ${formatError(error)}`
        );
      }
    }
  );

  // 命令：处理来自 MCP 的待处理上下文
  const processPending = vscode.commands.registerCommand(
    "cards.processPendingContexts",
    async () => {
      await processPendingContexts(context);
    }
  );

  context.subscriptions.push(captureCommand, openCollection, processPending);

  // 激活时检查是否有待处理的上下文
  setTimeout(() => {
    processPendingContexts(context);
  }, 1000);
}

export async function deactivate() {
  if (contextWatcher) {
    contextWatcher.close();
    contextWatcher = null;
  }
}

// 启动文件监听器
function startContextWatcher(context: vscode.ExtensionContext): void {
  // 确保目录存在
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  try {
    contextWatcher = fs.watch(CONTEXT_DIR, (eventType, filename) => {
      if (filename === "pending-contexts.json") {
        // 延迟处理，避免文件写入还未完成
        setTimeout(() => {
          processPendingContexts(context);
        }, 500);
      }
    });

    context.subscriptions.push({
      dispose: () => {
        if (contextWatcher) {
          contextWatcher.close();
          contextWatcher = null;
        }
      },
    });
  } catch (error) {
    console.error("Failed to start context watcher:", error);
  }
}

// 处理待处理的上下文
async function processPendingContexts(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    if (!fs.existsSync(CONTEXT_FILE)) {
      return;
    }

    const data = fs.readFileSync(CONTEXT_FILE, "utf8");
    const contexts: CapturedContext[] = JSON.parse(data);
    const pending = contexts.filter((c) => !c.processed);

    if (pending.length === 0) {
      return;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    // 获取 Git diff
    const diffText = await getGitDiff(workspaceRoot);

    // 为每个待处理的上下文生成卡片
    const allCards = [];
    for (const ctx of pending) {
      // 合并 conversationText 和 recentInputs 作为上下文
      const contextText = [
        ctx.conversationText,
        ...(ctx.recentInputs || []),
      ]
        .filter(Boolean)
        .join("\n\n");

      const cards = generateCards({
        contextText,
        diffText,
        selectionText: undefined,
      });

      allCards.push(...cards);

      // 标记为已处理
      ctx.processed = true;
    }

    // 更新文件，标记已处理
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(contexts, null, 2), "utf8");

    if (allCards.length > 0) {
      // 显示卡片
      const store = new CardsStore(workspaceRoot);
      cardsViewProvider?.update(allCards, "deal", async (card) => {
        const result = await store.addCards([card]);
        if (result.added.length > 0) {
          vscode.window.showInformationMessage("Card saved.");
        } else {
          vscode.window.showInformationMessage("Card already saved.");
        }
      });

      // 打开侧边栏
      await vscode.commands.executeCommand("workbench.view.extension.cardsView");

      // 通知用户
      vscode.window.showInformationMessage(
        `Generated ${allCards.length} card(s) from ${pending.length} AI conversation(s).`
      );
    }
  } catch (error) {
    console.error("Failed to process pending contexts:", error);
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
  } catch {
    return "";
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
