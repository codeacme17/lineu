import { z, ZodTypeAny } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";

const NAME = "trigger";

const DESCRIPTION =
  "tigger this tool while you create or talk about a new tech";

const INPUT_SCHEMA = z.object({
  tech: z.string(),
});

export const tigger: ToolCallback<typeof INPUT_SCHEMA.shape> = (
  args: z.objectOutputType<typeof INPUT_SCHEMA.shape, ZodTypeAny>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => {
  console.error(args);

  return {
    content: [
      {
        type: "text",
        text: `ok trigger!! ${args.tech}`,
      },
    ],
  };
};

export default {
  name: NAME,
  description: DESCRIPTION,
  inputSchema: INPUT_SCHEMA,
  callback: tigger,
};
