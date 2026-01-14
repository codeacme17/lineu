import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pushToVSCode, type EditorType } from "../vscode-bridge.js";
import { detectEditor } from "../utils.js";

const CardTypeSchema = z.enum(["bug", "best_practice", "knowledge"]);

const ActionSchema = z.enum(["create", "respark", "deepspark"]);

const InputSchema = {
  action: ActionSchema.optional().describe(
    "Action type: create (new card), respark (regenerate with different angle), deepspark (deep dive replacement)."
  ),
  cardId: z
    .string()
    .optional()
    .describe("Card ID to replace. Required for respark/deepspark actions."),
  type: CardTypeSchema.optional().describe(
    "Card type: bug (problem fix), best_practice (code best practices), knowledge (technical concepts)."
  ),
  seedText: z
    .string()
    .optional()
    .describe("Conversation context or summary from the AI session."),
  rawConversation: z
    .string()
    .optional()
    .describe(
      "Full conversation history for context. Stored but not displayed. " +
      "Used for respark/deepspark features. Include the complete dialogue."
    ),
  diff: z.string().optional().describe("Git diff content if available."),
  selection: z
    .string()
    .optional()
    .describe("User's code selection if available."),
  recentInputs: z.array(z.string()).optional().describe("Recent inputs list."),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Client-provided metadata."),
  pushToExtension: z
    .boolean()
    .optional()
    .describe("If true, push context to editor extension via URI handler."),
  editor: z
    .enum(["cursor", "vscode", "vscodium", "windsurf"])
    .optional()
    .describe("Target editor (auto-detected if not specified)."),
};

const OutputSchema = {
  conversationText: z
    .string()
    .describe("Captured context text without summarization."),
  recentInputs: z.array(z.string()).describe("Recent inputs as provided."),
  metadata: z.record(z.unknown()).describe("Metadata about the capture."),
  pushed: z
    .boolean()
    .optional()
    .describe("Whether context was pushed to VSCode extension."),
  pushError: z.string().optional().describe("Error message if push failed."),
};

export function registerCaptureContext(server: McpServer): void {
  server.registerTool(
    "capture_context",
    {
      description:
        "Capture and save knowledge cards from the conversation. " +
        "Use this when the user confirms they want to record insights. " +
        "Set pushToExtension: true to send cards to the IDE.",
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

      const editor = (args?.editor as EditorType) ?? detectEditor();
      const cardType = args?.type as
        | "bug"
        | "best_practice"
        | "knowledge"
        | undefined;

      if (args?.pushToExtension) {
        const action = args?.action as "create" | "respark" | "deepspark" | undefined;
        const result = await pushToVSCode(
          {
            action: action ?? "create",
            cardId: args.cardId,
            conversationText,
            rawConversation: args.rawConversation,
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
}
