import { z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";

const NAME = "healthz";
const DESCRIPTION = "Check the health of the server";
const INPUT_SCHEMA = z.object({});

const callback: ToolCallback = (
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => {
  return {
    content: [
      {
        type: "text",
        text: "ok health!!",
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
