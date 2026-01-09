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
pnpm --filter vscode-knowledge-cards build
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
├── lib/              # @lineu/lib - Shared card types and generation logic (internal)
├── mcp-server/       # @lineu/mcp-server - MCP server exposing capture_context tool
└── vscode-extension/ # vscode-knowledge-cards - VSCode extension for card generation
```

### Data Flow

1. **VSCode Extension** captures user selection + workspace context + git diff
2. Extension invokes **@lineu/lib** `generateCards()` to create cards from diff/context
3. Extension can also call **MCP Server** `capture_context` tool for protocol-compliant context capture
4. Cards are stored in `.vscode/knowledge-cards.json` per workspace

### Key Components

- **@lineu/lib**: Core card generation - parses git diffs, extracts patterns (functions, classes, config), creates up to 7 cards with stopword filtering and SHA256 deduplication
- **@lineu/mcp-server**: Stdio-based MCP server using `@modelcontextprotocol/sdk`, Zod validation, CLI executable `lineu-mcp-server`
- **vscode-knowledge-cards**: Extension with 5-tier MCP server resolution (user config → bundled → global npm → local node_modules → monorepo sibling)

## Development Workflow

1. Open repo root in VSCode
2. Run `pnpm install && pnpm build`
3. Press `F5` to launch Extension Development Host
4. Test commands: `Cards: Capture Context and Generate`, `Cards: Open Collection`

## MCP Server Configuration

For local development, configure your MCP client (Cursor, Claude Desktop):

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
- Claude Desktop: `claude_desktop_config.json`

## Notes

- No test suite or linting configured
- TypeScript strict mode enabled, target ES2022
- VSCode extension requires VSCode 1.90.0+
- Best use chinese
