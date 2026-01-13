# Knowledge Cards - VSCode Extension

A VSCode extension for generating draw-style knowledge cards from context and git diff.

## Features

- **Manual Capture**: Generate cards from selected text and git diff
- **MCP Push**: Receive context from AI assistants (Claude Code, etc.) via MCP server

## MCP Integration (AI-Assisted Workflow)

The extension can receive context pushed from AI coding assistants through the MCP server. When you're vibe-coding with Claude Code or similar tools, the AI can automatically send learning moments to the extension.

### How It Works

1. Configure `@lineu/mcp-server` in your AI assistant
2. During conversation, the AI calls `capture_context` with `pushToExtension: true`
3. The extension receives the context and generates Lineu Cards
4. You review and save the cards you want to keep

### Built-in MCP Server (recommended)

This extension ships with an embedded MCP server so users do not need to install `@lineu/mcp-server` manually.

Steps:

1. Run `Cards: Copy MCP Server Path` to copy the embedded server path.
2. Run `Cards: Copy MCP Config Snippet` and paste it into your AI tool's MCP config file.

### MCP Tool Usage

```json
{
  "seedText": "Discussion about React state management patterns...",
  "diff": "git diff output (optional)",
  "selection": "selected code (optional)",
  "pushToExtension": true,
  "editor": "cursor"
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `seedText` | string | Conversation context or summary |
| `diff` | string | Git diff content (optional) |
| `selection` | string | Code selection (optional) |
| `pushToExtension` | boolean | Set `true` to push to extension |
| `editor` | string | Target editor: `cursor` (default), `vscode`, `vscodium`, `windsurf` |

### Supported Editors

The MCP server supports multiple editors via URI schemes:

- **Cursor** (`cursor://`) - default
- **VS Code** (`vscode://`)
- **VSCodium** (`vscodium://`)
- **Windsurf** (`windsurf://`)

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build all packages
pnpm build

# Watch mode
pnpm watch
```

### Debug in VSCode

1. Open the repo root in VSCode
2. Press `F5` to launch Extension Development Host
3. Run command: `Cards: Capture Context and Generate`

## Commands

| Command                               | Description                         |
| ------------------------------------- | ----------------------------------- |
| `Cards: Capture Context and Generate` | Generate cards from current context |
| `Cards: Open Collection`              | View saved cards                    |
| `Cards: Configure OpenRouter API Key` | Set API key                         |
| `Cards: Copy MCP Server Path`         | Copy embedded MCP server path       |
| `Cards: Copy MCP Config Snippet`      | Copy MCP config JSON                |

## Configuration

| Setting                   | Default                        | Description                                 |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| `cards.diffMode`          | `unstaged`                     | Git diff mode: `unstaged`, `staged`, `both` |
| `cards.mcpServerPath`     | `""`                           | Custom MCP server path                      |
| `cards.openRouterBaseUrl` | `https://openrouter.ai/api/v1` | API base URL                                |
| `cards.openRouterModel`   | `""`                           | Default model name                          |

## Build & Publish

```bash
# Build
pnpm build

# Package .vsix
pnpm package

# Publish to marketplace (requires vsce login)
vsce publish
```

## MCP Server

The extension works with `@lineu/mcp-server`. It will look for the server in:

1. User-configured `cards.mcpServerPath`
2. Bundled server in extension
3. Global npm: `npm install -g @lineu/mcp-server`
4. Local node_modules

### Configure MCP Server for AI Assistants

**Claude Code / Cursor** (`~/.cursor/mcp.json`):
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

**Claude Desktop** (`claude_desktop_config.json`):
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

Once configured, the AI assistant can use the `capture_context` tool to push learning moments to your editor.
