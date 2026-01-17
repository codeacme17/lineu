import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getProjectName,
  getInboxPath,
  writeCardsFile,
  type Card,
} from "@lineu/lib";

const CardTypeSchema = z.enum(["bug", "best_practice", "knowledge"]);

// Schema for a single card in the array
const CardItemSchema = z.object({
  type: CardTypeSchema.optional().describe(
    "Card type: bug (problem fix), best_practice (code best practices), knowledge (technical concepts)."
  ),
  title: z.string().describe("Short title for the card (5-10 words)."),
  summary: z.string().describe("Brief summary of the insight (1-2 sentences)."),
  detail: z
    .string()
    .optional()
    .describe("Detailed explanation with context, examples, and key points."),
  tags: z
    .array(z.string())
    .max(2)
    .optional()
    .describe("1-2 tags for categorization. MAXIMUM 2 tags."),
  deepDiveOptions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "REQUIRED: 2-4 related topics for deeper exploration. MUST be included for each card. " +
        "Each should be a compelling topic title (5-15 words). " +
        "Examples: 'Browser vs Node.js Event Loop differences', 'Event Loop × Promise deep dive', " +
        "'Advanced error handling patterns', 'Performance optimization techniques'"
    ),
});

// Note: MCP SDK wraps these with z.object() internally, so we pass plain ZodRawShape
const InputSchema = {
  cards: z
    .array(CardItemSchema)
    .min(1)
    .max(7)
    .describe(
      "Array of cards to generate. Each card has type, title, summary, detail, and tags. " +
        "Generate 1-7 cards based on conversation insights."
    ),
  rawConversation: z
    .string()
    .optional()
    .describe(
      "COMPLETE conversation history including BOTH user messages AND AI responses. " +
        "Format: 'User: ...\\nAssistant: ...' - DO NOT omit AI responses! " +
        "This is critical for respark/deepspark features. Shared across all cards."
    ),
};

// Note: MCP SDK wraps these with z.object() internally, so we pass plain ZodRawShape
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
        "Capture and save multiple knowledge cards from the conversation. " +
        "Use this when the user confirms they want to record insights. " +
        "Can generate 1-7 cards at once based on different aspects of the conversation.",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
    },
    async (args) => {
      const inputCards = (args?.cards as z.infer<typeof CardItemSchema>[]) ?? [];
      const rawConversation = args?.rawConversation as string | undefined;

      if (inputCards.length === 0) {
        return {
          content: [{ type: "text", text: "No cards provided." }],
          structuredContent: {
            cardsGenerated: 0,
            projectName: "unknown",
            inboxPath: "",
          },
        };
      }

      // Determine project name from cwd
      const cwd = process.cwd();
      const projectName = getProjectName(cwd);
      const now = Date.now();

      // Build cards from MCP input
      const cards: Card[] = inputCards.map((input, index) => ({
        id: `card-${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        type: input.type,
        title: input.title,
        summary: input.summary,
        detail: input.detail,
        tags: (input.tags ?? []).slice(0, 2),
        source: "context",
        createdAt: new Date().toISOString(),
        project: projectName,
        context: rawConversation,
        deepDiveOptions: input.deepDiveOptions?.slice(0, 4),
        dives: [],
      }));

      // Write to inbox (replaces existing inbox content)
      const inboxPath = getInboxPath(projectName);
      await writeCardsFile(inboxPath, cards);

      const titles = cards.map((c) => c.title).join(", ");
      const statusMessage = `Generated ${cards.length} card(s) for project "${projectName}": ${titles}`;

      return {
        content: [
          {
            type: "text",
            text: statusMessage,
          },
        ],
        structuredContent: {
          cardsGenerated: cards.length,
          projectName,
          inboxPath,
        },
      };
    }
  );
}
