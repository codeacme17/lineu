import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "../tools/index.js";

const TOOL_PREFIX = "lineu";

export const toolRegister = (server: McpServer) => {
  try {
    Object.values(tools).forEach((tool) => {
      const name = `${TOOL_PREFIX}-${tool.name}`;
      const description = tool.description;
      const inputSchema = tool.inputSchema?.shape ?? {};
      const callback = (
        args: z.objectOutputType<
          typeof tool.inputSchema.shape,
          z.ZodTypeAny
        >,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => (tool.callback as any)(args, extra);

      server.tool(name, description, inputSchema, callback);
    });
  } catch (error) {
    console.error("Fatal error in toolRegister():", error);
    throw new Error(`Fatal error in toolRegister(): ${error}`);
  }
};
