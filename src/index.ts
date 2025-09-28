import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { toolRegister } from "./libs/tool-register.js";

async function main() {
  try {
    const server = new McpServer({
      name: "lineu",
      version: "0.0.1",
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    toolRegister(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Lineu MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main();
