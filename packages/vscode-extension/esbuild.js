const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");
const webviewUiDir = path.join(rootDir, "webview-ui");

// 源文件路径
const mcpSource = path.join(rootDir, "..", "mcp-server", "dist", "index.js");
const agentsSource = path.join(rootDir, "..", "lib", "agents");
const resourcesSource = path.join(rootDir, "..", "..", "assets", "pictures");
const webviewSource = path.join(webviewUiDir, "dist");

// 目标路径（全部在 dist 下）
const mcpTarget = path.join(distDir, "mcp-server.js");
const agentsTarget = path.join(distDir, "agents");
const resourcesTarget = path.join(distDir, "resources");
const webviewTarget = path.join(distDir, "webview");

/**
 * 递归复制目录
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 复制所有资源到 dist 目录
 */
async function copyAssets() {
  // MCP server
  await fs.mkdir(distDir, { recursive: true });
  await fs.copyFile(mcpSource, mcpTarget);

  // Agents 配置
  await fs.rm(agentsTarget, { recursive: true, force: true });
  await copyDir(agentsSource, agentsTarget);

  // Resources (图片等)
  await fs.rm(resourcesTarget, { recursive: true, force: true });
  await copyDir(resourcesSource, resourcesTarget);

  // Webview UI
  await fs.rm(webviewTarget, { recursive: true, force: true });
  await copyDir(webviewSource, webviewTarget);
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

    // 构建 webview-ui 并复制所有资源
    await buildWebviewUi();
    await copyAssets();

    console.log("Watching for changes...");
    return;
  }

  // 生产构建：先构建 webview-ui，再构建扩展，最后复制资源
  await buildWebviewUi();
  await esbuild.build(buildOptions);
  await copyAssets();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
