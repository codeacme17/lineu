const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const rootDir = __dirname;
const mcpSource = path.join(rootDir, "..", "mcp-server", "dist");
const mcpTarget = path.join(rootDir, "mcp-server", "dist");
const hooksSource = path.join(rootDir, "..", "..", "hooks");
const hooksTarget = path.join(rootDir, "hooks");
const webviewUiDir = path.join(rootDir, "webview-ui");

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

/**
 * 构建 webview-ui React 应用
 */
async function buildWebviewUi() {
  return new Promise((resolve, reject) => {
    const npm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const child = spawn(npm, ["run", "build"], {
      cwd: webviewUiDir,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Webview UI built successfully.");
        resolve();
      } else {
        reject(new Error(`Webview UI build failed with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

/**
 * 检查 webview-ui 依赖是否已安装
 */
async function ensureWebviewUiDeps() {
  const nodeModules = path.join(webviewUiDir, "node_modules");
  try {
    await fs.access(nodeModules);
  } catch {
    console.log("Installing webview-ui dependencies...");
    return new Promise((resolve, reject) => {
      const npm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
      const child = spawn(npm, ["install"], {
        cwd: webviewUiDir,
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pnpm install failed with code ${code}`));
        }
      });

      child.on("error", reject);
    });
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
  // 首先确保 webview-ui 依赖已安装
  await ensureWebviewUiDeps();

  if (watch) {
    // 并行启动 extension 和 webview-ui 的 watch
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    await copyMcpServer();
    await copyHooks();

    // 启动 webview-ui 开发服务器（可选）
    // 在 watch 模式下，你可以选择手动运行 `pnpm run dev` 来启用热更新
    // 这里我们只构建一次
    await buildWebviewUi();

    console.log("Watching for changes...");
    return;
  }

  // 生产构建：先构建 webview-ui，再构建扩展
  await buildWebviewUi();
  await esbuild.build(buildOptions);
  await copyMcpServer();
  await copyHooks();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
