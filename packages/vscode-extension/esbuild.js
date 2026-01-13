const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs/promises");

const production = process.argv.includes("--production");

const rootDir = __dirname;
const mcpSource = path.join(rootDir, "..", "mcp-server", "dist");
const mcpTarget = path.join(rootDir, "mcp-server", "dist");

async function copyMcpServer() {
  await fs.rm(mcpTarget, { recursive: true, force: true });
  await fs.cp(mcpSource, mcpTarget, { recursive: true });
}

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: !production,
    minify: production,
  })
  .then(() => copyMcpServer())
  .catch(() => process.exit(1));
