import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getProjectName,
  getBaseStoragePath,
  getCardsPath,
  getInboxPath,
  readCardsFile,
  writeCardsFile,
  type Card,
  type DiveRecord,
} from "@lineu/lib";

// Schema for the dive record input
const DiveInputSchema = z.object({
  topic: z.string().describe("The topic being explored"),
  summary: z.string().describe("Brief summary of the exploration (1-2 sentences)"),
  detail: z
    .string()
    .optional()
    .describe("Detailed exploration content with examples and key points"),
  deepDiveOptions: z
    .array(z.string())
    .min(2)
    .max(4)
    .optional()
    .describe("2-4 new related topics for further exploration"),
});

const InputSchema = {
  cardId: z.string().describe("The ID of the card to append the dive to"),
  dive: DiveInputSchema.describe("The dive record to append"),
};

const OutputSchema = {
  success: z.boolean().describe("Whether the dive was successfully appended"),
  cardId: z.string().describe("The ID of the updated card"),
  diveCount: z.number().describe("Total number of dives on the card after append"),
  message: z.string().describe("Status message"),
};

export function registerDeepDive(server: McpServer): void {
  server.registerTool(
    "deep_dive",
    {
      description:
        "Append a deep dive exploration record to an existing card. " +
        "Use this when the user wants to explore a topic further from an existing spark. " +
        "The dive record will be added to the card's dives array.",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
    },
    async (args) => {
      const cardId = args?.cardId as string;
      const diveInput = args?.dive as z.infer<typeof DiveInputSchema>;

      if (!cardId || !diveInput) {
        return {
          content: [{ type: "text", text: "Missing cardId or dive data." }],
          structuredContent: {
            success: false,
            cardId: cardId || "",
            diveCount: 0,
            message: "Missing cardId or dive data.",
          },
        };
      }

      // Search for the card across all projects
      const basePath = getBaseStoragePath();
      let foundProject: string | null = null;
      let cards: Card[] = [];
      let cardIndex = -1;
      let targetPath = "";
      let isInbox = false;

      // Get all project directories
      let projectDirs: string[] = [];
      try {
        const entries = await fs.promises.readdir(basePath, { withFileTypes: true });
        projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      } catch {
        // Base path doesn't exist yet
        projectDirs = [];
      }

      // Also try current project first
      const cwd = process.cwd();
      const currentProject = getProjectName(cwd);
      if (!projectDirs.includes(currentProject)) {
        projectDirs.unshift(currentProject);
      }

      // Search in each project
      for (const project of projectDirs) {
        const cardsPath = getCardsPath(project);
        const inboxPath = getInboxPath(project);

        // Check saved cards
        const savedCards = await readCardsFile(cardsPath);
        cardIndex = savedCards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          foundProject = project;
          cards = savedCards;
          targetPath = cardsPath;
          isInbox = false;
          break;
        }

        // Check inbox
        const inboxCards = await readCardsFile(inboxPath);
        cardIndex = inboxCards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          foundProject = project;
          cards = inboxCards;
          targetPath = inboxPath;
          isInbox = true;
          break;
        }
      }

      if (cardIndex === -1 || !foundProject) {
        return {
          content: [
            {
              type: "text",
              text: `Card with ID "${cardId}" not found in any project.`,
            },
          ],
          structuredContent: {
            success: false,
            cardId,
            diveCount: 0,
            message: `Card not found in any project.`,
          },
        };
      }

      // Build the dive record
      const dive: DiveRecord = {
        topic: diveInput.topic,
        summary: diveInput.summary,
        detail: diveInput.detail,
        deepDiveOptions: diveInput.deepDiveOptions?.slice(0, 4),
        createdAt: new Date().toISOString(),
      };

      // Append dive to the card
      const card = cards[cardIndex];
      if (!card.dives) {
        card.dives = [];
      }
      card.dives.push(dive);

      // Save updated cards to the correct file
      await writeCardsFile(targetPath, cards);

      const location = isInbox ? "inbox" : "saved cards";
      const message = `Deep dive "${diveInput.topic}" appended to card "${card.title}" in project "${foundProject}" (${location})`;

      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          success: true,
          cardId,
          diveCount: card.dives.length,
          message,
        },
      };
    }
  );
}
