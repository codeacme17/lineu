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
├── lib/              # @lineu/lib - Shared card types and generation logic (internal)
├── mcp-server/       # @lineu/mcp-server - MCP server exposing capture_context tool
└── vscode-extension/ # lineu - VSCode extension for spark generation
```

### Data Flow

**Manual flow (extension-initiated):**
1. **VSCode Extension** captures user selection + workspace context + git diff
2. Extension invokes **@lineu/lib** `generateCards()` to create cards from diff/context
3. Cards are stored in `.vscode/knowledge-cards.json` per workspace

**MCP Push flow (AI-initiated):**
1. AI assistant (Claude Code, etc.) calls MCP `capture_context` tool with `pushToExtension: true`
2. MCP server writes context to temp file, triggers `{editor}://lineu.lineu/capture?file=...` URI
3. Extension's URI handler reads file, generates cards, shows webview

### Key Components

- **@lineu/lib**: Core card generation - parses git diffs, extracts patterns (functions, classes, config), creates up to 7 cards with stopword filtering and SHA256 deduplication
- **@lineu/mcp-server**: Stdio-based MCP server using `@modelcontextprotocol/sdk`, Zod validation, supports pushing context to editors via URI handler
- **lineu**: Extension with URI handler (`onUri` activation) for receiving MCP push, 5-tier MCP server resolution

### MCP `capture_context` Tool

Key parameters for AI-assisted workflow:
- `type`: Card type - `bug`, `best_practice`, or `knowledge` (triggers different UI styles)
- `seedText`: Conversation context or summary
- `diff`: Git diff content (optional)
- `pushToExtension`: Set `true` to push to editor extension
- `editor`: Target editor - `cursor` (default), `vscode`, `vscodium`, `windsurf`

**Card type UI styles:**
- `bug`: Red border and badge
- `best_practice`: Green border and badge
- `knowledge`: Blue border and badge

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

## Hooks Configuration (Auto Knowledge Capture)

This project includes a hook that automatically triggers the knowledge capture UI when an AI assistant completes a task.

### How It Works

1. AI assistant completes a task → `stop` hook triggers
2. Hook directly opens `cursor://lineu.lineu/capture?file=...` URI
3. Extension shows capture dialog → user can save knowledge card

**No AI involvement required** - the hook triggers the extension directly.

### Project-Level Configuration (Already Included)

**Cursor** (`.cursor/hooks.json`):
```json
{
  "version": 1,
  "hooks": {
    "stop": [{ "command": "python3 ./hooks/lineu-capture.py" }]
  }
}
```

**Claude Code** (`.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/hooks/lineu-capture.py\"" }] }]
  }
}
```

### User-Level Configuration (For All Projects)

**Cursor** (`~/.cursor/hooks.json`):
```json
{
  "version": 1,
  "hooks": {
    "stop": [{ "command": "python3 /path/to/lineu/hooks/lineu-capture.py" }]
  }
}
```

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "python3 /path/to/lineu/hooks/lineu-capture.py" }] }]
  }
}
```

## Notes

- No test suite or linting configured
- TypeScript strict mode enabled, target ES2022
- VSCode extension requires VSCode 1.90.0+
- Extension must be installed in target editor for URI handler to work
- Use `pnpm package` in vscode-extension to create .vsix for installation
- Prefer Chinese for user-facing communication
