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

**Manual flow (extension-initiated):**
1. **VSCode Extension** captures user selection + workspace context + git diff
2. Extension invokes **@lineu/lib** `generateCards()` to create cards from diff/context
3. Cards are stored in `.vscode/knowledge-cards.json` per workspace

**MCP Push flow (AI-initiated):**
1. AI assistant (Claude Code, etc.) calls MCP `capture_context` tool with `pushToExtension: true`
2. MCP server writes context to temp file, triggers `{editor}://lineu.vscode-knowledge-cards/capture?file=...` URI
3. Extension's URI handler reads file, generates cards, shows webview

### Key Components

- **@lineu/lib**: Core card generation - parses git diffs, extracts patterns (functions, classes, config), creates up to 7 cards with stopword filtering and SHA256 deduplication
- **@lineu/mcp-server**: Stdio-based MCP server using `@modelcontextprotocol/sdk`, Zod validation, supports pushing context to editors via URI handler
- **vscode-knowledge-cards**: Extension with URI handler (`onUri` activation) for receiving MCP push, 5-tier MCP server resolution

### MCP `capture_context` Tool

Key parameters for AI-assisted workflow:
- `type`: Card type - `bug`, `best_practice`, or `knowledge` (triggers different UI styles)
- `seedText`: Conversation context or summary
- `diff`: Git diff content (optional)
- `pushToExtension`: Set `true` to push to editor extension
- `editor`: Target editor - `cursor` (default), `vscode`, `vscodium`, `windsurf`

**When to call this tool (proactive triggers):**
- `type: "bug"` - When you help fix a bug or debug an issue, capture the root cause and solution
- `type: "best_practice"` - **AFTER completing code changes**, if the implementation involves design patterns, architectural decisions, performance optimizations, or non-obvious techniques
- `type: "knowledge"` - **AFTER completing a task**, if you used important concepts, APIs, or techniques that the user should remember

**IMPORTANT: You should proactively call `capture_context` after completing tasks to help users retain key insights they might otherwise overlook during vibe-coding.**

**Card type UI styles:**
- `bug`: Red border and badge
- `best_practice`: Green border and badge
- `knowledge`: Blue border and badge

**Example: When to trigger**
```
User: "帮我实现一个防抖函数"
AI: [完成代码编写]
AI: [主动调用 capture_context with type: "knowledge", seedText: "防抖函数通过 setTimeout 延迟执行，每次调用时先清除之前的定时器..."]
```

## AI Behavior Rules (MUST READ)

**CRITICAL: After completing ANY task, you MUST call the `ask_to_capture` MCP tool to ask the user if they want to record the insight.**

### Two-Step Flow:

1. **Step 1: Ask** → Call `ask_to_capture` with:
   - `type`: "bug" | "best_practice" | "knowledge"
   - `summary`: 简洁描述本次任务的关键知识点

2. **Step 2: Capture** → If user responds "是/好/记录/yes", call `capture_context` with:
   - `type`: same as above
   - `seedText`: detailed summary
   - `pushToExtension`: true

### Example Flow:
```
User: "帮我实现一个防抖函数"
AI: [完成代码编写]
AI: [调用 ask_to_capture with type: "knowledge", summary: "防抖函数通过 setTimeout 延迟执行，每次调用时清除之前的定时器"]
AI: 显示提示 "📝 是否记录这个💡 知识点？"
User: "是"
AI: [调用 capture_context with pushToExtension: true]
```

**DO NOT skip the ask_to_capture step.** The goal is to help users retain key learnings during vibe-coding.

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
- Extension must be installed in target editor for URI handler to work
- Use `pnpm package` in vscode-extension to create .vsix for installation
- Prefer Chinese for user-facing communication
