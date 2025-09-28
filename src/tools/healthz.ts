import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

const NAME = "healthz";
const DESCRIPTION = "Check the health of the server";

const healthz: ToolCallback = () => {
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
  callback: healthz,
};
