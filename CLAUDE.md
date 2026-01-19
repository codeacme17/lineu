# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode for development
pnpm watch

# Clean all packages
pnpm clean
```

### Per-Package Commands

```bash
# Build specific package
pnpm --filter @lineu/mcp-server build
pnpm --filter lineu build
pnpm --filter @lineu/lib build

# Run MCP server locally
node packages/mcp-server/dist/index.js

# Package VSCode extension
cd packages/vscode-extension && pnpm package
```

## Architecture

This is a pnpm monorepo with three packages:

```
packages/
├── lib/              # @lineu/lib - Shared card types, generation logic, storage utilities, and agent configs
│   └── agents/       # AI agent configurations (copied to extension during build)
│       ├── cursor/   # Cursor commands and rules
│       └── claude-code/  # Claude Code commands
├── mcp-server/       # @lineu/mcp-server - MCP server exposing capture_context tool
└── vscode-extension/ # lineu - VSCode extension for spark generation and display
    └── src/
        ├── host/     # Extension host code (Node.js)
        └── webview/  # Webview UI (React + Vite)
```

### Data Flow

**Manual flow (extension-initiated):**
1. VSCode Extension captures user selection + workspace context + git diff
2. Extension invokes `@lineu/lib` `generateCards()` to create cards
3. Cards displayed in sidebar webview, saved to `~/.lineu/{project}/cards.json`

**MCP Push flow (AI-initiated):**
1. AI assistant calls MCP `capture_context` tool with `cards[]` array
2. MCP server writes cards to `~/.lineu/{project}/inbox.json`
3. Extension's file watcher detects inbox change, reads cards, shows webview

### Storage Paths

- `~/.lineu/{project}/inbox.json` - New cards from MCP (replaced on each spark)
- `~/.lineu/{project}/cards.json` - Saved/favorited cards (persistent)

### Key Components

- **@lineu/lib**: Card types, diff parsing, pattern extraction (functions, classes, config), SHA256 deduplication, storage path helpers
- **@lineu/lib/agents**: AI agent configurations - Cursor rules (`auto-spark.cursorrules`), slash commands (`/spark`, `/respark`, `/deepspark`)
- **@lineu/mcp-server**: Stdio-based MCP server using `@modelcontextprotocol/sdk` with Zod validation
- **lineu (host)**: Extension host with fs.watch on `~/.lineu/` for inbox detection, onboarding flow, MCP config management
- **lineu (webview)**: React app for displaying cards, built with Vite, outputs to `dist/webview/`

### MCP `capture_context` Tool

Input parameters:
- `cards`: Array of 1-7 cards, each with:
  - `type`: `bug` | `best_practice` | `knowledge`
  - `title`: Short title (5-10 words)
  - `summary`: Brief summary (1-2 sentences)
  - `detail`: Optional detailed explanation
  - `tags`: Optional array of 1-2 tags
- `rawConversation`: Optional full conversation for respark/deepspark

## Development Workflow

1. Open repo root in VSCode
2. Run `pnpm install && pnpm build`
3. Press `F5` to launch Extension Development Host
4. Test commands: `Cards: Capture Context and Generate`, `Cards: Open Collection`

## MCP Server Configuration

For local development, configure your MCP client:

```json
{
  "mcpServers": {
    "lineu": {
      "command": "node",
      "args": ["/path/to/lineu/packages/mcp-server/dist/index.js"]
    }
  }
}
```

- Cursor: `~/.cursor/mcp.json`
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

## Spark Commands

| Command | Description |
|---------|-------------|
| `/spark` | Capture knowledge sparks from the conversation |
| `/respark` | Generate different perspectives from the same context |
| `/deepspark` | Deep dive into a topic |

Commands source: `packages/lib/agents/{cursor,claude-code}/commands/`
Installed to: `~/.cursor/commands/` or `~/.claude/commands/` via onboarding

### Auto-Spark Rules

Cursor rules with `alwaysApply: true` can trigger automatic spark capture:
- Source: `packages/lib/agents/cursor/rules/auto-spark.cursorrules`
- Installed to: `~/.cursor/rules/` via onboarding

## Build Output

Extension `dist/` contains all assets after build:
- `extension.js` - Bundled extension host
- `mcp-server.js` - Bundled MCP server (copied from mcp-server package)
- `agents/` - AI agent configs (copied from lib/agents)
- `resources/` - Icons and images (copied from assets/pictures)
- `webview/` - Built React app (main.js, style.css)

## Notes

- No test suite or linting configured
- TypeScript strict mode enabled, target ES2022
- VSCode extension requires VSCode 1.90.0+
- Use `pnpm package` in vscode-extension to create .vsix for installation
- Prefer Chinese for user-facing communication
