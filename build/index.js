import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools/index.js";
const server = new McpServer({
    name: "lineu",
    version: "0.0.1",
    capabilities: {
        resources: {},
        tools: {},
    },
});
server.tool(tools.healthz.name, tools.healthz.description, tools.healthz.callback);
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Lineu MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
