import * as vscode from "vscode";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CaptureContextInput, CaptureContextResult } from "@lineu/lib";

const execAsync = promisify(exec);

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string
  ) {}

  async captureContext(
    input: CaptureContextInput
  ): Promise<CaptureContextResult> {
    await this.ensureConnected();
    if (!this.client) {
      throw new Error("MCP client not available.");
    }

    const result = await this.client.callTool({
      name: "capture_context",
      arguments: {
        seedText: input.seedText ?? "",
        recentInputs: input.recentInputs ?? [],
        metadata: input.metadata ?? {},
      },
    });

    if (result.structuredContent) {
      return result.structuredContent as CaptureContextResult;
    }

    return {
      conversationText: "",
      recentInputs: [],
      metadata: {},
    };
  }

  async dispose(): Promise<void> {
    await this.transport?.close();
    this.transport = null;
    this.client = null;
    this.connecting = null;
  }

  private async ensureConnected(): Promise<void> {
    if (this.client) {
      return;
    }
    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.connect();
    await this.connecting;
  }

  private async connect(): Promise<void> {
    const serverPath = await this.resolveMcpServerPath();
    if (!serverPath || !existsSync(serverPath)) {
      throw new Error(
        `MCP server not found. Install @lineu/mcp-server globally or configure cards.mcpServerPath`
      );
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      cwd: this.workspaceRoot,
      stderr: "pipe",
    });
    const client = new Client({
      name: "cards-extension",
      version: "0.0.1",
    });

    await client.connect(transport);
    this.transport = transport;
    this.client = client;
  }

  private async resolveMcpServerPath(): Promise<string | undefined> {
    // Priority 1: User-configured custom path
    const config = vscode.workspace.getConfiguration("cards");
    const customPath = config.get<string>("mcpServerPath");
    if (customPath && existsSync(customPath)) {
      return customPath;
    }

    // Priority 2: Bundled server in extension
    const bundledPath = this.context.asAbsolutePath("dist/mcp-server/index.js");
    if (existsSync(bundledPath)) {
      return bundledPath;
    }

    // Priority 3: Global npm installation
    try {
      const { stdout } = await execAsync("npm root -g");
      const globalPath = path.join(
        stdout.trim(),
        "@lineu/mcp-server/dist/index.js"
      );
      if (existsSync(globalPath)) {
        return globalPath;
      }
    } catch {
      // Ignore errors
    }

    // Priority 4: Local node_modules (development mode)
    const localPath = path.join(
      this.workspaceRoot,
      "node_modules/@lineu/mcp-server/dist/index.js"
    );
    if (existsSync(localPath)) {
      return localPath;
    }

    // Priority 5: Monorepo sibling package (development mode)
    const monoRepoPath = path.join(
      this.context.extensionPath,
      "../mcp-server/dist/index.js"
    );
    if (existsSync(monoRepoPath)) {
      return monoRepoPath;
    }

    return undefined;
  }
}
