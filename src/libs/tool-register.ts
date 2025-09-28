import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "../tools/index.js";

export const toolRegister = (server: McpServer) => {
  try {
    Object.values(tools).forEach((tool) => {
      server.tool(tool.name, tool.description, tool.callback);
    });
  } catch (error) {
    console.error("Fatal error in toolRegister():", error);
    throw new Error(`Fatal error in toolRegister(): ${error}`);
  }
};
