# Repository Guidelines

## Project Structure & Module Organization
Lineu is a TypeScript-based Model Context Protocol server. Authoritative sources live under `src/`: `index.ts` boots the `McpServer`, `libs/tool-register.ts` wires tools into the server, and `tools/` groups individual tool modules (keep filenames kebab-cased to mirror tool names). The TypeScript compiler emits CommonJS output into `build/`; never edit compiled files by hand. Use `temp/` for ad-hoc artifacts that should stay out of version control.

## Build, Test, and Development Commands
Run `pnpm install` once to hydrate dependencies. `pnpm build` performs a strict TypeScript compile and prepares the executable at `build/index.js`. During active development prefer `pnpm watch` for incremental builds. After compiling, start the server with `node build/index.js` or inspect it via `pnpm inspector`, which shells into the MCP inspector UI.

## Coding Style & Naming Conventions
Follow the repository’s default TypeScript configuration (`strict` mode, ES2022 target). Use 2-space indentation, const-first declarations, and keep exports explicit. Tools should export a default object shaped like the existing entries with `name`, `description`, `inputSchema`, and a `callback`. Prefer descriptive camelCase identifiers; reserve SCREAMING_SNAKE_CASE for constants shared across functions.

## Testing Guidelines
A formal test suite is not yet established. When adding features, include lightweight runtime checks by exercising the tool through the MCP inspector and logging structured diagnostics. If you introduce automated tests, colocate them alongside the code under `src/` (e.g., `tool-name.spec.ts`) and wire `pnpm test` into `package.json`. Aim for coverage on error paths and schema validation logic.

## Commit & Pull Request Guidelines
Commit messages follow the conventional `<type>: <summary>` style (`feat`, `refactor`, `chore`, etc.). Keep summaries under 72 characters and describe the user-facing impact. Pull requests should reference relevant issues, outline behavioral changes, call out new tools or schemas, and attach console output or inspector screenshots when behavior is hard to infer. Ensure `pnpm build` passes before requesting review.

## Agent Integration Notes
When registering new tools, reuse the `TOOL_PREFIX` defined in `tool-register.ts` so external callers see consistent `lineu-*` names. Validate input schemas with `zod.describe` hints—clear descriptions surface directly inside LLM-powered inspectors.
