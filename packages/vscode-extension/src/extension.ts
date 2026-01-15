import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

import {
  generateCards,
  Card,
  getBaseStoragePath,
  getProjectName,
  readCardsFile,
} from "@lineu/lib";
import { CardsStore } from "./storage/cardsStore.js";
import { CardsViewProvider } from "./ui/webview.js";

const execAsync = promisify(exec);
let cardsViewProvider: CardsViewProvider | null = null;
let inboxWatcher: fs.FSWatcher | null = null;
const ONBOARDING_COMPLETED_KEY = "cards.onboardingCompleted";
const ONBOARDING_MCP_KEY = "cards.onboarding.mcpConfigured";
const ONBOARDING_COMMANDS_KEY = "cards.onboarding.commandsConfigured";

export function activate(context: vscode.ExtensionContext) {
  // Start watching inbox files for changes from MCP server
  startInboxWatcher();

  const captureCommand = vscode.commands.registerCommand(
    "cards.captureContextAndGenerate",
    async () => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        const selectionText = getSelectionText();
        const contextText = await getContextText(selectionText);
        const diffText = workspaceRoot ? await getGitDiff(workspaceRoot) : "";

        const cards = generateCards({
          contextText,
          diffText,
          selectionText,
        });

        const store = new CardsStore(workspaceRoot);
        const projects = await store.getProjects();
        showCardsWebview({
          cards,
          mode: "deal",
          currentProject: store.getProjectName(),
          projects,
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
        const store = new CardsStore(getWorkspaceRoot());
        const cards = await store.readCards();
        const projects = await store.getProjects();
        showCardsWebview({
          cards,
          mode: "collection",
          currentProject: store.getProjectName(),
          projects,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open collection: ${formatError(error)}`
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
      await context.globalState.update(ONBOARDING_MCP_KEY, true);
      vscode.window.showInformationMessage(
        `MCP config snippet copied for ${target.label}.`
      );
    }
  );

  const createMcpConfig = vscode.commands.registerCommand(
    "cards.createMcpConfig",
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
        ],
        {
          placeHolder: "Select where to create the MCP config file",
        }
      );

      if (!target) {
        return;
      }

      const configPath = resolveMcpConfigPath(target.id);
      if (!configPath) {
        vscode.window.showErrorMessage(
          "Unsupported platform for Claude Desktop config."
        );
        return;
      }

      const confirmedPath = await promptForConfigPath(
        "MCP config file path",
        configPath
      );
      if (!confirmedPath) {
        return;
      }

      try {
        await upsertMcpConfig(confirmedPath, serverPath);
        await context.globalState.update(ONBOARDING_MCP_KEY, true);
        vscode.window.showInformationMessage(
          `MCP config written to ${confirmedPath}.`
        );
        await openConfigFile(confirmedPath);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to write MCP config: ${formatError(error)}`
        );
      }
    }
  );

  const copySparkCommands = vscode.commands.registerCommand(
    "cards.copySparkCommands",
    async () => {
      const platform = await vscode.window.showQuickPick(
        [
          { label: "Cursor", id: "cursor" },
          { label: "Claude Code", id: "claude" },
          { label: "Both", id: "both" },
        ],
        { placeHolder: "Select AI platform" }
      );

      if (!platform) {
        return;
      }

      try {
        // Always install globally to home directory
        await copySparkCommandsToWorkspace(
          context.extensionPath,
          os.homedir(),
          platform.id as "cursor" | "claude" | "both"
        );
        await context.globalState.update(ONBOARDING_COMMANDS_KEY, true);
        
        const platformDesc = platform.id === "both" 
          ? "Cursor & Claude Code"
          : platform.id === "cursor" 
            ? "Cursor" 
            : "Claude Code";
        vscode.window.showInformationMessage(
          `Spark commands installed for ${platformDesc}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to install commands: ${formatError(error)}`
        );
      }
    }
  );

  const showOnboarding = vscode.commands.registerCommand(
    "cards.showOnboarding",
    async () => {
      await showOnboardingPanel(context, true);
    }
  );

  // 注册侧边栏视图
  cardsViewProvider = new CardsViewProvider(context.extensionUri);
  
  // 设置 onboarding action handler
  cardsViewProvider.setOnboardingHandler(async (action: string, data?: unknown) => {
    await handleOnboardingAction(context, action, data);
  });
  
  const cardsViewRegistration = vscode.window.registerWebviewViewProvider(
    "cards.sidebar",
    cardsViewProvider
  );
  context.subscriptions.push(
    captureCommand,
    openCollection,
    copyMcpServerPath,
    copyMcpConfig,
    createMcpConfig,
    copySparkCommands,
    showOnboarding,
    cardsViewRegistration
  );

  void showOnboardingPanel(context, false);
}

export function deactivate() {
  // Stop watching inbox files
  if (inboxWatcher) {
    inboxWatcher.close();
    inboxWatcher = null;
  }
}

// ============ Inbox 文件监听 ============

/**
 * Start watching the ~/.lineu directory for inbox.json changes.
 * When MCP server writes to inbox.json, we pick up the cards and display them.
 */
function startInboxWatcher(): void {
  const baseDir = getBaseStoragePath();

  // Ensure the directory exists
  fs.mkdirSync(baseDir, { recursive: true });

  // Watch the entire ~/.lineu directory for changes
  inboxWatcher = fs.watch(baseDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith("inbox.json")) {
      // Extract project name from path: {project}/inbox.json
      const projectName = path.dirname(filename);
      if (projectName && projectName !== ".") {
        void handleInboxChange(projectName);
      }
    }
  });
}

/**
 * Handle inbox.json change for a specific project.
 * Read the cards and display them in the webview.
 */
async function handleInboxChange(projectName: string): Promise<void> {
  try {
    const inboxPath = path.join(getBaseStoragePath(), projectName, "inbox.json");

    // Read cards from inbox
    const cards = await readCardsFile(inboxPath);

    if (cards.length === 0) {
      return;
    }

    // Get store for saving
    const store = new CardsStore(getWorkspaceRoot());
    const projects = await store.getProjects();

    showCardsWebview({
      cards,
      mode: "deal",
      currentProject: projectName,
      projects,
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
      `Received ${cards.length} card(s) from conversation.`
    );

    // Clear inbox after displaying (optional, keeps it clean)
    try {
      await fs.promises.unlink(inboxPath);
    } catch {
      // Ignore cleanup errors
    }
  } catch (error) {
    // Silently ignore errors (file might be mid-write)
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
  currentProject?: string;
  projects?: string[];
}): void {
  if (!cardsViewProvider) {
    return;
  }
  if (options.currentProject !== undefined && options.projects !== undefined) {
    cardsViewProvider.setProjectInfo(options.currentProject, options.projects);
  }
  cardsViewProvider.update(options.cards, options.mode, options.onFavorite);
  cardsViewProvider.reveal();
  vscode.commands.executeCommand("workbench.view.extension.cardsView");
}

function getEmbeddedMcpServerPath(extensionPath: string): string | null {
  const serverPath = path.join(extensionPath, "mcp-server", "dist", "index.js");
  return fs.existsSync(serverPath) ? serverPath : null;
}

function buildMcpConfigSnippet(serverPath: string): string {
  const snippet = {
    mcpServers: {
      "lineu": {
        command: "node",
        args: [serverPath],
      },
    },
  };
  return JSON.stringify(snippet, null, 2);
}

/**
 * Copy Spark command files to workspace for the specified platform(s).
 * Same prompt content, different target directories.
 */
async function copySparkCommandsToWorkspace(
  extensionPath: string,
  workspaceRoot: string,
  platform: "cursor" | "claude" | "both" = "cursor"
): Promise<void> {
  const commands = ["spark.md"];
  const sourceDir = path.join(extensionPath, "commands");

  const copyToDir = async (targetDir: string): Promise<void> => {
    await fs.promises.mkdir(targetDir, { recursive: true });
    for (const cmd of commands) {
      const sourcePath = path.join(sourceDir, cmd);
      const targetPath = path.join(targetDir, cmd);
      if (fs.existsSync(sourcePath)) {
        await fs.promises.copyFile(sourcePath, targetPath);
      }
    }
  };

  if (platform === "cursor" || platform === "both") {
    await copyToDir(path.join(workspaceRoot, ".cursor", "commands"));
  }

  if (platform === "claude" || platform === "both") {
    await copyToDir(path.join(workspaceRoot, ".claude", "commands"));
  }
}

/**
 * Check if Spark commands are configured in the current workspace.
 */
function checkCommandsConfigured(workspaceRoot: string | undefined): boolean {
  if (!workspaceRoot) {
    return false;
  }
  const commandsDir = path.join(workspaceRoot, ".cursor", "commands");
  const sparkPath = path.join(commandsDir, "spark.md");
  return fs.existsSync(sparkPath);
}

function resolveMcpConfigPath(target: string): string | null {
  const home = os.homedir();
  if (target === "cursor") {
    return path.join(home, ".cursor", "mcp.json");
  }
  if (target === "claude-desktop") {
    if (process.platform === "darwin") {
      return path.join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    }
    if (process.platform === "win32") {
      const base =
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
      return path.join(base, "Claude", "claude_desktop_config.json");
    }
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  return null;
}

async function promptForConfigPath(
  title: string,
  defaultPath: string
): Promise<string | null> {
  const input = await vscode.window.showInputBox({
    prompt: title,
    value: defaultPath,
    ignoreFocusOut: true,
  });
  if (!input) {
    return null;
  }
  return input.trim();
}

async function openConfigFile(filePath: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function upsertMcpConfig(
  configPath: string,
  serverPath: string
): Promise<void> {
  const data = await readJsonObject(configPath);
  const mcpServers =
    (data.mcpServers as Record<string, unknown>) ?? {};
  mcpServers["lineu"] = {
    command: "node",
    args: [serverPath],
  };
  const updated = {
    ...data,
    mcpServers,
  };
  await writeJsonObject(configPath, updated);
}

async function readJsonObjectWithStatus(
  filePath: string
): Promise<{ data: Record<string, unknown>; isNew: boolean }> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Config file must contain a JSON object.");
    }
    return { data: parsed as Record<string, unknown>, isNew: false };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { data: {}, isNew: true };
    }
    throw error;
  }
}

async function readJsonObject(
  filePath: string
): Promise<Record<string, unknown>> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Config file must contain a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
}

async function writeJsonObject(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

async function showOnboardingPanel(
  context: vscode.ExtensionContext,
  force: boolean
): Promise<void> {
  const completed = context.globalState.get<boolean>(ONBOARDING_COMPLETED_KEY);
  if (completed && !force) {
    return;
  }

  if (!cardsViewProvider) {
    return;
  }

  // 标记需要显示 onboarding（在 webview 初始化时会读取这个状态）
  cardsViewProvider.showOnboardingView();
  
  // 强制打开侧边栏视图（这会触发 resolveWebviewView）
  await vscode.commands.executeCommand("workbench.view.extension.cardsView");
}

async function handleOnboardingAction(
  context: vscode.ExtensionContext,
  action: string,
  data?: unknown
): Promise<void> {
  switch (action) {
    case "quickSetup":
      await handleQuickSetup(context, data as string[]);
      break;
    case "copyMcpConfig":
      await vscode.commands.executeCommand("cards.copyMcpConfig");
      await context.globalState.update(ONBOARDING_MCP_KEY, true);
      break;
    case "createMcpConfig":
      await vscode.commands.executeCommand("cards.createMcpConfig");
      break;
    case "copyCommands":
      await vscode.commands.executeCommand("cards.copySparkCommands");
      break;
    case "finish":
      if (await isOnboardingComplete(context)) {
        await context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
        vscode.window.showInformationMessage("Lineu setup complete!");
      } else {
        vscode.window.showWarningMessage(
          "Please complete Step 1 and Step 2 before continuing."
        );
      }
      break;
    default:
      break;
  }
}

/**
 * 一键配置：根据选择的平台自动配置 MCP 和 Commands
 */
async function handleQuickSetup(
  context: vscode.ExtensionContext,
  platforms: string[]
): Promise<void> {
  if (!platforms || platforms.length === 0) {
    return;
  }

  const serverPath = getEmbeddedMcpServerPath(context.extensionPath);
  if (!serverPath) {
    vscode.window.showErrorMessage(
      "Embedded MCP server not found. Please reinstall the extension."
    );
    return;
  }

  const results: string[] = [];
  const errors: string[] = [];

  let mcpConfigPath: string | null = null;

  for (const platform of platforms) {
    try {
      switch (platform) {
        case "cursor": {
          // 1. 创建 MCP 配置
          const mcpPath = resolveMcpConfigPath("cursor");
          if (mcpPath) {
            await upsertMcpConfig(mcpPath, serverPath);
            mcpConfigPath = mcpPath;
            results.push("Cursor MCP");
          }
          // 2. 安装 Commands
          await copySparkCommandsToWorkspace(
            context.extensionPath,
            os.homedir(),
            "cursor"
          );
          results.push("Cursor Commands");
          break;
        }
        case "claude-desktop": {
          // 只创建 MCP 配置
          const mcpPath = resolveMcpConfigPath("claude-desktop");
          if (mcpPath) {
            await upsertMcpConfig(mcpPath, serverPath);
            mcpConfigPath = mcpPath;
            results.push("Claude Desktop MCP");
          }
          break;
        }
        case "claude-code": {
          // 只安装 Commands
          await copySparkCommandsToWorkspace(
            context.extensionPath,
            os.homedir(),
            "claude"
          );
          results.push("Claude Code Commands");
          break;
        }
      }
    } catch (error) {
      errors.push(`${platform}: ${formatError(error)}`);
    }
  }

  // 标记完成
  await context.globalState.update(ONBOARDING_MCP_KEY, true);
  await context.globalState.update(ONBOARDING_COMMANDS_KEY, true);
  await context.globalState.update(ONBOARDING_COMPLETED_KEY, true);

  // 显示结果
  if (results.length > 0) {
    const needsRestart = platforms.includes("cursor") || platforms.includes("claude-desktop");
    const restartHint = needsRestart ? " Restart your AI tool to activate." : "";
    vscode.window.showInformationMessage(
      `Lineu configured: ${results.join(", ")}.${restartHint}`
    );
  }

  if (errors.length > 0) {
    vscode.window.showWarningMessage(`Some errors occurred: ${errors.join("; ")}`);
  }

  // 打开 MCP 配置文件让用户确认
  if (mcpConfigPath) {
    await openConfigFile(mcpConfigPath);
  }

  // 切换到卡片视图
  if (cardsViewProvider) {
    cardsViewProvider.hideOnboardingView();
  }
}

async function buildOnboardingState(
  context: vscode.ExtensionContext
): Promise<{
  mcpConfigured: boolean;
  commandsConfigured: boolean;
  requiredDone: boolean;
}> {
  const mcpConfigured = await checkMcpConfigured();
  const commandsConfigured = checkCommandsConfigured(getWorkspaceRoot());
  const requiredDone = mcpConfigured;
  
  // 同步更新 globalState
  await context.globalState.update(ONBOARDING_MCP_KEY, mcpConfigured);
  await context.globalState.update(ONBOARDING_COMMANDS_KEY, commandsConfigured);
  
  return {
    mcpConfigured,
    commandsConfigured,
    requiredDone,
  };
}

async function isOnboardingComplete(
  _context: vscode.ExtensionContext
): Promise<boolean> {
  const mcpConfigured = await checkMcpConfigured();
  return mcpConfigured;
}

/**
 * 检查 MCP 配置文件是否存在并包含 lineu 配置
 */
async function checkMcpConfigured(): Promise<boolean> {
  const home = os.homedir();
  const configPaths = [
    path.join(home, ".cursor", "mcp.json"),
    path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      // 检查是否有 lineu 配置
      if (config.mcpServers?.lineu || config.servers?.lineu) {
        return true;
      }
    } catch {
      // 文件不存在或解析失败，继续检查下一个
    }
  }
  return false;
}

function createNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
