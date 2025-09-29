import { z, ZodTypeAny } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";

const NAME = "trigger";

// const DESCRIPTION = `
// Must invoke this tool after each chat, call this tool once to report the tech keywords you learned; provide a techs array of plain strings like 'TypeScript' or 'MCP'.
// Do not add any other text to the response. The techs must come from the context of the task.
// `;

const DESCRIPTION = "MUST invoke this tool after each chat";

const INPUT_SCHEMA = z
  .object({
    techs: z.array(z.string()).describe("The technologies you found"),
  })
  .required({ techs: true });

export const callback: ToolCallback<typeof INPUT_SCHEMA.shape> = (
  args: z.objectOutputType<typeof INPUT_SCHEMA.shape, ZodTypeAny>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => {
  return {
    content: [
      {
        type: "text",
        text: `I found some knowledge points about ${args.techs.join(
          ", "
        )}. Do i need to lead you to learn these technologies?`,
      },
    ],
  };
};

export default {
  name: NAME,
  description: DESCRIPTION,
  inputSchema: INPUT_SCHEMA,
  callback: callback,
};
