import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// 共享上下文文件 - VS Code 插件会监听这个文件
const CONTEXT_DIR = path.join(os.homedir(), ".lineu");
const CONTEXT_FILE = path.join(CONTEXT_DIR, "pending-contexts.json");

type CapturedContext = {
  id: string;
  conversationText: string;
  recentInputs: string[];
  metadata: Record<string, unknown>;
  timestamp: string;
  processed: boolean;
};

function saveContext(ctx: CapturedContext): void {
  try {
    if (!fs.existsSync(CONTEXT_DIR)) {
      fs.mkdirSync(CONTEXT_DIR, { recursive: true });
    }
    let contexts: CapturedContext[] = [];
    if (fs.existsSync(CONTEXT_FILE)) {
      try {
        contexts = JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));
      } catch {
        contexts = [];
      }
    }
    contexts.push(ctx);
    // 保留最近 100 条
    const trimmed = contexts.slice(-100);
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(trimmed, null, 2), "utf8");
  } catch {
    // 写入失败不影响主流程
  }
}

const InputSchema = {
  seedText: z.string().optional().describe("Raw context seed from the client."),
  recentInputs: z.array(z.string()).optional().describe("Recent inputs list."),
  metadata: z.record(z.string()).optional().describe("Client-provided metadata."),
};

const OutputSchema = {
  conversationText: z
    .string()
    .describe("Captured context text without summarization."),
  recentInputs: z.array(z.string()).describe("Recent inputs as provided."),
  metadata: z.record(z.unknown()).describe("Metadata about the capture."),
};

export async function startServer(): Promise<void> {
  try {
    const server = new McpServer({
      name: "cards-mcp",
      version: "0.0.1",
      capabilities: {
        tools: {},
      },
    });

    server.registerTool(
      "capture_context",
      {
        description: "Return raw context captured from the current session.",
        inputSchema: InputSchema,
        outputSchema: OutputSchema,
      },
      async (args: {
        seedText?: string;
        recentInputs?: string[];
        metadata?: Record<string, string>;
      }) => {
        const now = new Date().toISOString();
        const conversationText = args?.seedText ?? "";
        const recentInputs = args?.recentInputs ?? [];
        const metadata = {
          timestamp: now,
          cwd: process.cwd(),
          ...(args?.metadata ?? {}),
        };

        // 保存到共享文件，供 VS Code 插件读取
        saveContext({
          id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          conversationText,
          recentInputs,
          metadata,
          timestamp: now,
          processed: false,
        });

        return {
          content: [
            {
              type: "text",
              text: "Context captured.",
            },
          ],
          structuredContent: {
            conversationText,
            recentInputs,
            metadata,
          },
        };
      }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("MCP server failed:", error);
    process.exit(1);
  }
}
