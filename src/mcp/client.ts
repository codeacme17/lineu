import * as vscode from "vscode";
import * as path from "node:path";
import { existsSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type CaptureContextResult = {
  conversationText: string;
  recentInputs: string[];
  metadata: Record<string, unknown>;
};

export type CaptureContextInput = {
  seedText?: string;
  recentInputs?: string[];
  metadata?: Record<string, string>;
};

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
    const serverPath = this.context.asAbsolutePath("build/mcp/server.js");
    if (!existsSync(serverPath)) {
      throw new Error(
        `MCP server not found at ${path.basename(serverPath)}. Run npm run compile.`
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
}
