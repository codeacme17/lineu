import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pushToVSCode, type EditorType } from "./vscode-bridge.js";

/**
 * Auto-detect which editor is running based on environment variables.
 */
function detectEditor(): EditorType {
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? "";

  if (termProgram.includes("cursor")) return "cursor";
  if (termProgram.includes("vscode") || termProgram.includes("code")) return "vscode";
  if (termProgram.includes("vscodium")) return "vscodium";
  if (termProgram.includes("windsurf")) return "windsurf";

  // Check for editor-specific env vars
  if (process.env.CURSOR_CHANNEL) return "cursor";
  if (process.env.VSCODE_GIT_IPC_HANDLE || process.env.VSCODE_IPC_HOOK) return "vscode";

  // Default to vscode as it's most common
  return "vscode";
}

const CardTypeSchema = z.enum(["bug", "best_practice", "knowledge"]);

const InputSchema = {
  type: CardTypeSchema.optional().describe("Card type: bug (problem fix), best_practice (code best practices), knowledge (technical concepts)."),
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
          "Capture conversation context and generate knowledge cards to help users retain important insights during vibe-coding. " +
          "**IMPORTANT: Proactively call this tool in these scenarios:** " +
          "1. [bug] When you help fix a bug or debug an issue - capture the root cause and solution. " +
          "2. [best_practice] AFTER completing code changes - if the implementation involves design patterns, architectural decisions, performance optimizations, or non-obvious techniques, capture them. " +
          "3. [knowledge] AFTER completing a task - if you used important concepts, APIs, or techniques that the user might want to remember, capture them as knowledge cards. " +
          "**The goal is to remind users of key learnings they might otherwise overlook.** " +
          "Set pushToExtension: true to push cards to the editor extension.",
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
        const editor = (args?.editor as EditorType) ?? detectEditor();
        const cardType = args?.type as "bug" | "best_practice" | "knowledge" | undefined;
        if (args?.pushToExtension) {
          const result = await pushToVSCode(
            {
              conversationText,
              diff: args.diff,
              selection: args.selection,
              metadata,
              type: cardType,
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
