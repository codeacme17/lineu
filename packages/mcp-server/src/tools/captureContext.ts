import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getProjectName,
  getInboxPath,
  writeCardsFile,
  type Card,
} from "@lineu/lib";

const CardTypeSchema = z.enum(["bug", "best_practice", "knowledge"]);

const InputSchema = {
  type: CardTypeSchema.optional().describe(
    "Card type: bug (problem fix), best_practice (code best practices), knowledge (technical concepts)."
  ),
  title: z
    .string()
    .optional()
    .describe("Short title for the card (5-10 words)."),
  summary: z
    .string()
    .optional()
    .describe("Brief summary of the insight (1-2 sentences)."),
  detail: z
    .string()
    .optional()
    .describe("Detailed explanation with context, examples, and key points."),
  tags: z
    .array(z.string())
    .optional()
    .describe("1-2 tags for categorization. MAXIMUM 2 tags."),
  rawConversation: z
    .string()
    .optional()
    .describe(
      "Full conversation history for context. Stored but not displayed. " +
        "Used for respark/deepspark features. Include the complete dialogue."
    ),
  pushToExtension: z
    .boolean()
    .optional()
    .describe("If true, write cards to inbox for extension to pick up."),
};

const OutputSchema = {
  cardsGenerated: z.number().describe("Number of cards generated."),
  projectName: z.string().describe("Project name where cards were saved."),
  inboxPath: z.string().describe("Path to the inbox file."),
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
      const title = args?.title ?? "Untitled";
      const summary = args?.summary ?? "";
      const detail = args?.detail;
      const tags = ((args?.tags as string[]) ?? []).slice(0, 2); // Max 2 tags
      const rawConversation = args?.rawConversation;
      const cardType = args?.type as
        | "bug"
        | "best_practice"
        | "knowledge"
        | undefined;

      // Determine project name from cwd
      const cwd = process.cwd();
      const projectName = getProjectName(cwd);

      // Build card directly from MCP input
      const card: Card = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: cardType,
        title,
        summary,
        detail,
        tags,
        source: "context",
        createdAt: new Date().toISOString(),
        project: projectName,
        context: rawConversation,
      };

      const cards = [card];

      // Write to inbox (replaces existing inbox content)
      const inboxPath = getInboxPath(projectName);

      if (args?.pushToExtension) {
        await writeCardsFile(inboxPath, cards);
      }

      const statusMessage = `Generated card "${title}" for project "${projectName}".`;

      return {
        content: [
          {
            type: "text",
            text: statusMessage,
          },
        ],
        structuredContent: {
          cardsGenerated: 1,
          projectName,
          inboxPath,
        },
      };
    }
  );
}
