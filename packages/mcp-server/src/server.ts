import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pushToVSCode, type EditorType } from "./vscode-bridge.js";

const InputSchema = {
  seedText: z.string().optional().describe("Conversation context or summary from the AI session."),
  diff: z.string().optional().describe("Git diff content if available."),
  selection: z.string().optional().describe("User's code selection if available."),
  recentInputs: z.array(z.string()).optional().describe("Recent inputs list."),
  metadata: z.record(z.string()).optional().describe("Client-provided metadata."),
  pushToExtension: z.boolean().optional().describe("If true, push context to editor extension via URI handler."),
  editor: z.enum(["cursor", "vscode", "vscodium", "windsurf"]).optional().describe("Target editor: cursor (default), vscode, vscodium, or windsurf."),
};

const OutputSchema = {
  conversationText: z
    .string()
    .describe("Captured context text without summarization."),
  recentInputs: z.array(z.string()).describe("Recent inputs as provided."),
  metadata: z.record(z.unknown()).describe("Metadata about the capture."),
  pushed: z.boolean().optional().describe("Whether context was pushed to VSCode extension."),
  pushError: z.string().optional().describe("Error message if push failed."),
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
        description:
          "Capture context from the current AI session and optionally push to VSCode extension for card generation. " +
          "Use pushToExtension: true to send the context to the Lineu VSCode extension.",
        inputSchema: InputSchema,
        outputSchema: OutputSchema,
      },
      async (args) => {
        const now = new Date().toISOString();
        const conversationText = args?.seedText ?? "";
        const recentInputs = args?.recentInputs ?? [];
        const metadata = {
          timestamp: now,
          cwd: process.cwd(),
          ...(args?.metadata ?? {}),
        };

        let pushed: boolean | undefined;
        let pushError: string | undefined;

        // Push to editor extension if requested
        const editor = (args?.editor as EditorType) ?? "cursor";
        if (args?.pushToExtension) {
          const result = await pushToVSCode(
            {
              conversationText,
              diff: args.diff,
              selection: args.selection,
              metadata,
            },
            { editor }
          );
          pushed = result.success;
          if (!result.success) {
            pushError = result.error;
          }
        }

        const statusMessage = pushed
          ? `Context captured and sent to ${editor} extension.`
          : pushed === false
            ? `Context captured but failed to send to ${editor}: ${pushError}`
            : "Context captured.";

        return {
          content: [
            {
              type: "text",
              text: statusMessage,
            },
          ],
          structuredContent: {
            conversationText,
            recentInputs,
            metadata,
            pushed,
            pushError,
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
