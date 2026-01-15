const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node",
  },
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
    return;
  }

  await esbuild.build(buildOptions);
  console.log("MCP server built successfully.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
