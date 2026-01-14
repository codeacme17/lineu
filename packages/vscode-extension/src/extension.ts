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
const ONBOARDING_COMPLETED_KEY = "cards.onboardingCompleted";
const ONBOARDING_MCP_KEY = "cards.onboarding.mcpConfigured";
const ONBOARDING_COMMANDS_KEY = "cards.onboarding.commandsConfigured";

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
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("Open a workspace to view cards.");
          return;
        }

        const store = new CardsStore(workspaceRoot);
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
      const workspaceRoot = getWorkspaceRoot();

      // Choose scope: global or project
      const scope = await vscode.window.showQuickPick(
        [
          { 
            label: "Global (all projects)", 
            id: "global", 
            description: "~/.cursor/commands/ or ~/.claude/commands/" 
          },
          { 
            label: "Current project only", 
            id: "project", 
            description: ".cursor/commands/ or .claude/commands/",
            disabled: !workspaceRoot
          },
        ].filter(item => !item.disabled),
        { placeHolder: "Where to install Spark commands?" }
      );

      if (!scope) {
        return;
      }

      const platform = await vscode.window.showQuickPick(
        [
          { label: "Cursor", id: "cursor", description: ".cursor/commands/" },
          { label: "Claude Code", id: "claude", description: ".claude/commands/" },
          { label: "Both", id: "both", description: "Copy to both platforms" },
        ],
        { placeHolder: "Select AI platform" }
      );

      if (!platform) {
        return;
      }

      try {
        const targetRoot = scope.id === "global" ? os.homedir() : workspaceRoot!;
        await copySparkCommandsToWorkspace(
          context.extensionPath,
          targetRoot,
          platform.id as "cursor" | "claude" | "both"
        );
        await context.globalState.update(ONBOARDING_COMMANDS_KEY, true);
        
        const scopeDesc = scope.id === "global" ? "globally" : "to project";
        const platformDesc = platform.id === "both" 
          ? "Cursor & Claude"
          : platform.id === "cursor" 
            ? "Cursor" 
            : "Claude Code";
        vscode.window.showInformationMessage(
          `Spark commands installed ${scopeDesc} for ${platformDesc}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to copy Spark commands: ${formatError(error)}`
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
  cardsViewProvider.setOnboardingHandler(async (action: string) => {
    await handleOnboardingAction(context, action);
  });
  
  const cardsViewRegistration = vscode.window.registerWebviewViewProvider(
    "cards.sidebar",
    cardsViewProvider
  );
  context.subscriptions.push(
    uriHandler,
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
  // No-op for now
}

// ============ MCP 上下文处理 ============

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
      action?: "create" | "respark" | "deepspark";
      cardId?: string;
      conversationText?: string;
      rawConversation?: string;
      diff?: string;
      selection?: string;
      metadata?: Record<string, unknown>;
      type?: "bug" | "best_practice" | "knowledge";
    };

    const store = new CardsStore(workspaceRoot);
    const action = incomingContext.action ?? "create";

    // Handle respark/deepspark: replace existing card
    if ((action === "respark" || action === "deepspark") && incomingContext.cardId) {
      const cards = generateCards({
        contextText: incomingContext.conversationText || "",
        diffText: incomingContext.diff || "",
        selectionText: incomingContext.selection || "",
        type: incomingContext.type,
      });

      if (cards.length > 0) {
        const newCard = cards[0];
        // Preserve the original card ID for replacement
        newCard.id = incomingContext.cardId;
        // Attach raw conversation
        if (incomingContext.rawConversation) {
          newCard.context = incomingContext.rawConversation;
        }
        
        await store.replaceCard(incomingContext.cardId, newCard);
        
        // Refresh the webview with updated cards
        const allCards = await store.readCards();
        const projects = await store.getProjects();
        showCardsWebview({
          cards: allCards,
          mode: "collection",
          currentProject: store.getProjectName(),
          projects,
        });
        
        const actionLabel = action === "respark" ? "Resparked" : "Deep dived";
        vscode.window.showInformationMessage(`${actionLabel} card updated.`);
      }
    } else {
      // Normal create flow
      const cards = generateCards({
        contextText: incomingContext.conversationText || "",
        diffText: incomingContext.diff || "",
        selectionText: incomingContext.selection || "",
        type: incomingContext.type,
      });

      // Attach raw conversation to cards for respark/deepspark
      if (incomingContext.rawConversation) {
        for (const card of cards) {
          card.context = incomingContext.rawConversation;
        }
      }

      if (cards.length === 0) {
        vscode.window.showInformationMessage("No cards generated from context.");
        return;
      }

      // Show cards in webview
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

      vscode.window.showInformationMessage(
        `Received ${cards.length} card(s) from vibe-coding session.`
      );
    }

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
  const commands = ["spark.md", "respark.md", "deepspark.md"];
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

  // 获取当前 onboarding 状态
  const state = await buildOnboardingState(context);
  cardsViewProvider.updateOnboardingState({
    mcpConfigured: state.mcpConfigured,
    commandsConfigured: state.commandsConfigured,
  });
  
  // 显示 onboarding 视图
  cardsViewProvider.showOnboardingView();
  cardsViewProvider.reveal();
}

async function handleOnboardingAction(
  context: vscode.ExtensionContext,
  action: string
): Promise<void> {
  switch (action) {
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

  // 更新 onboarding 状态
  if (cardsViewProvider) {
    const state = await buildOnboardingState(context);
    cardsViewProvider.updateOnboardingState({
      mcpConfigured: state.mcpConfigured,
      commandsConfigured: state.commandsConfigured,
    });
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
