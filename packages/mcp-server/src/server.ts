import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCaptureContext, registerDeepDive } from "./tools/index.js";

export async function startServer(): Promise<void> {
  try {
    const server = new McpServer({
      name: "lineu-mcp",
      version: "0.0.1",
      capabilities: {
        tools: {},
      },
    });

    // Register all tools
    registerCaptureContext(server);
    registerDeepDive(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("MCP server failed:", error);
    process.exit(1);
  }
}
