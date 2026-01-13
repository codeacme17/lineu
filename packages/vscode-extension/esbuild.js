const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs/promises");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const rootDir = __dirname;
const mcpSource = path.join(rootDir, "..", "mcp-server", "dist");
const mcpTarget = path.join(rootDir, "mcp-server", "dist");
const hooksSource = path.join(rootDir, "..", "..", "hooks");
const hooksTarget = path.join(rootDir, "hooks");

async function copyMcpServer() {
  await fs.rm(mcpTarget, { recursive: true, force: true });
  await fs.cp(mcpSource, mcpTarget, { recursive: true });
}

async function copyHooks() {
  await fs.rm(hooksTarget, { recursive: true, force: true });
  await fs.cp(hooksSource, hooksTarget, { recursive: true });
  const hookScript = path.join(hooksTarget, "lineu-capture.py");
  try {
    await fs.chmod(hookScript, 0o755);
  } catch {
    // Ignore chmod errors on unsupported platforms.
  }
}

const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !production,
  minify: production,
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    await copyMcpServer();
    await copyHooks();
    console.log("Watching for changes...");
    return;
  }

  await esbuild.build(buildOptions);
  await copyMcpServer();
  await copyHooks();
}

run().catch(() => process.exit(1));
