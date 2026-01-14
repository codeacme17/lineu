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
const ONBOARDING_API_KEY = "cards.onboarding.apiKeyConfigured";
const ONBOARDING_MCP_KEY = "cards.onboarding.mcpConfigured";
const ONBOARDING_HOOKS_KEY = "cards.onboarding.hooksConfigured";

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

  const copyHooksConfig = vscode.commands.registerCommand(
    "cards.copyHooksConfig",
    async () => {
      const hookPath = getHookScriptPath(context.extensionPath);
      if (!hookPath) {
        vscode.window.showErrorMessage(
          "Hook script not found. Reinstall the extension."
        );
        return;
      }

      const target = await vscode.window.showQuickPick(
        [
          { label: "Cursor", id: "cursor" },
          { label: "Claude Code", id: "claude-code" },
        ],
        {
          placeHolder: "Select where to use the hooks config",
        }
      );

      if (!target) {
        return;
      }

      const config = buildHooksConfigSnippet(target.id, hookPath);
      await vscode.env.clipboard.writeText(config);
      await context.globalState.update(ONBOARDING_HOOKS_KEY, true);
      vscode.window.showInformationMessage(
        `Hooks config copied for ${target.label}.`
      );
    }
  );

  const createHooksConfig = vscode.commands.registerCommand(
    "cards.createHooksConfig",
    async () => {
      const hookPath = getHookScriptPath(context.extensionPath);
      if (!hookPath) {
        vscode.window.showErrorMessage(
          "Hook script not found. Reinstall the extension."
        );
        return;
      }

      const target = await vscode.window.showQuickPick(
        [
          { label: "Cursor", id: "cursor" },
          { label: "Claude Code", id: "claude-code" },
        ],
        {
          placeHolder: "Select where to create the hooks config file",
        }
      );

      if (!target) {
        return;
      }

      const configPath = resolveHooksConfigPath(target.id);
      if (!configPath) {
        vscode.window.showErrorMessage("Unsupported platform for hooks config.");
        return;
      }

      const confirmedPath = await promptForConfigPath(
        "Hooks config file path",
        configPath
      );
      if (!confirmedPath) {
        return;
      }

      try {
        await upsertHooksConfig(confirmedPath, hookPath);
        await context.globalState.update(ONBOARDING_HOOKS_KEY, true);
        vscode.window.showInformationMessage(
          `Hooks config written to ${confirmedPath}.`
        );
        await openConfigFile(confirmedPath);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to write hooks config: ${formatError(error)}`
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
    configureOpenRouter,
    copyMcpServerPath,
    copyMcpConfig,
    createMcpConfig,
    copyHooksConfig,
    createHooksConfig,
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

function getHookScriptPath(extensionPath: string): string | null {
  const hookPath = path.join(extensionPath, "hooks", "lineu-capture.py");
  return fs.existsSync(hookPath) ? hookPath : null;
}

function buildHooksConfigSnippet(target: string, hookPath: string): string {
  if (target === "cursor") {
    return JSON.stringify(
      {
        hooks: {
          stop: [
            {
              command: hookPath,
            },
          ],
        },
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      hooks: {
        stop: [
          {
            command: hookPath,
          },
        ],
      },
    },
    null,
    2
  );
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

function resolveHooksConfigPath(target: string): string | null {
  const home = os.homedir();
  if (target === "cursor") {
    return path.join(home, ".cursor", "hooks.json");
  }
  if (target === "claude-code") {
    return path.join(home, ".claude", "settings.json");
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
  mcpServers["lineu-cards"] = {
    command: "node",
    args: [serverPath],
  };
  const updated = {
    ...data,
    mcpServers,
  };
  await writeJsonObject(configPath, updated);
}

async function upsertHooksConfig(
  configPath: string,
  hookPath: string
): Promise<void> {
  const data = await readJsonObject(configPath);
  const hooks = (data.hooks as Record<string, unknown>) ?? {};
  const stop = Array.isArray(hooks.stop) ? [...hooks.stop] : [];
  const alreadyExists = stop.some(
    (item) => item && typeof item === "object" && item.command === hookPath
  );
  if (!alreadyExists) {
    stop.push({ command: hookPath });
  }
  const updated = {
    ...data,
    hooks: {
      ...hooks,
      stop,
    },
  };
  await writeJsonObject(configPath, updated);
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
    apiKeyConfigured: state.apiKeyConfigured,
    mcpConfigured: state.mcpConfigured,
    hooksConfigured: state.hooksConfigured,
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
    case "configureOpenRouter":
      await vscode.commands.executeCommand("cards.configureOpenRouterApiKey");
      await markApiKeyConfigured(context);
      break;
    case "copyMcpConfig":
      await vscode.commands.executeCommand("cards.copyMcpConfig");
      await context.globalState.update(ONBOARDING_MCP_KEY, true);
      break;
    case "createMcpConfig":
      await vscode.commands.executeCommand("cards.createMcpConfig");
      break;
    case "copyHooksConfig":
      await vscode.commands.executeCommand("cards.copyHooksConfig");
      await context.globalState.update(ONBOARDING_HOOKS_KEY, true);
      break;
    case "createHooksConfig":
      await vscode.commands.executeCommand("cards.createHooksConfig");
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
      apiKeyConfigured: state.apiKeyConfigured,
      mcpConfigured: state.mcpConfigured,
      hooksConfigured: state.hooksConfigured,
    });
  }
}

async function buildOnboardingState(
  context: vscode.ExtensionContext
): Promise<{
  apiKeyConfigured: boolean;
  mcpConfigured: boolean;
  hooksConfigured: boolean;
  requiredDone: boolean;
}> {
  const apiKeyConfigured = await hasOpenRouterApiKey(context);
  const mcpConfigured =
    context.globalState.get<boolean>(ONBOARDING_MCP_KEY) ?? false;
  const hooksConfigured =
    context.globalState.get<boolean>(ONBOARDING_HOOKS_KEY) ?? false;
  const requiredDone = apiKeyConfigured && mcpConfigured;
  if (apiKeyConfigured) {
    await context.globalState.update(ONBOARDING_API_KEY, true);
  }
  return {
    apiKeyConfigured,
    mcpConfigured,
    hooksConfigured,
    requiredDone,
  };
}

async function isOnboardingComplete(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const apiKeyConfigured = await hasOpenRouterApiKey(context);
  const mcpConfigured =
    context.globalState.get<boolean>(ONBOARDING_MCP_KEY) ?? false;
  return apiKeyConfigured && mcpConfigured;
}

async function markApiKeyConfigured(
  context: vscode.ExtensionContext
): Promise<void> {
  const hasKey = await hasOpenRouterApiKey(context);
  if (hasKey) {
    await context.globalState.update(ONBOARDING_API_KEY, true);
  }
}

async function hasOpenRouterApiKey(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const value = await context.secrets.get("cards.openRouterApiKey");
  return Boolean(value);
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
