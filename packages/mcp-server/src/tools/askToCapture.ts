import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const CardTypeSchema = z.enum(["bug", "best_practice", "knowledge"]);

const InputSchema = {
  type: CardTypeSchema.describe(
    "Suggested card type based on the task: bug, best_practice, or knowledge"
  ),
  summary: z
    .string()
    .describe(
      "A brief summary (1-2 sentences in Chinese) of the key insight or technique used"
    ),
};

const OutputSchema = {
  prompt: z.string().describe("The prompt shown to the user"),
  suggestedType: CardTypeSchema,
  suggestedSummary: z.string(),
};

export function registerAskToCapture(server: McpServer): void {
  server.registerTool(
    "ask_to_capture",
    {
      description:
        "Generate a knowledge summary card. Call this tool to provide the user with a structured summary of what was accomplished. " +
        "This tool produces output that should be part of your response - do not skip it. " +
        "\n\n" +
        "Call this after: writing code, fixing bugs, explaining concepts, or making technical decisions. " +
        "The user can then choose to save this as a permanent knowledge card.",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
    },
    async (args) => {
      const cardType = args?.type ?? "knowledge";
      const summary = args?.summary ?? "本次对话的关键知识点";

      const typeLabels: Record<string, string> = {
        bug: "🐛 Bug 修复",
        best_practice: "✨ 最佳实践",
        knowledge: "💡 知识点",
      };

      const prompt =
        `\n📝 **是否记录这个${typeLabels[cardType] || "知识点"}？**\n\n` +
        `> ${summary}\n\n` +
        `回复 "是" 或 "记录" 来保存到知识卡片。`;

      return {
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
        structuredContent: {
          prompt,
          suggestedType: cardType,
          suggestedSummary: summary,
        },
      };
    }
  );
}
