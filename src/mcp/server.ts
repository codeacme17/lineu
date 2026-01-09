import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

async function main() {
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

main();
