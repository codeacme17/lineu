# Lineu MCP Server

MCP (Model Context Protocol) server for capturing AI conversation contexts and generating knowledge cards.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Cursor / Claude Desktop / Other AI Tools                       │
│                                                                  │
│  User: "How do I fix this authentication bug?"                   │
│  AI: [provides solution]                                         │
│                                                                  │
│  → AI calls capture_context tool                                 │
│                                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (this package)                                       │
│                                                                  │
│  Writes context to ~/.lineu/pending-contexts.json                │
│                                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  VS Code Extension (watches the file)                            │
│                                                                  │
│  Detects new context → Generates knowledge cards → Shows in UI   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Build the MCP Server

```bash
cd packages/mcp-server
pnpm install
pnpm build
```

### 2. Configure in Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "lineu-cards": {
      "command": "node",
      "args": ["/path/to/lineu/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 3. Configure in Claude Desktop

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "lineu-cards": {
      "command": "node",
      "args": ["/path/to/lineu/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Usage

Once configured, you can ask the AI to capture context:

> "Please capture this conversation about authentication debugging for my knowledge cards."

The AI will call the `capture_context` tool, which saves the context. The VS Code extension will automatically detect it and generate cards.

## Tool: capture_context

### Description

Capture the current AI conversation context for generating knowledge cards.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `conversationText` | string | The AI conversation or response text |
| `userQuery` | string | The user's original question |
| `codeContext` | string | Code snippets being discussed |
| `metadata` | object | Additional metadata (file paths, language, etc.) |

### Example

```json
{
  "conversationText": "To fix the authentication issue, you need to...",
  "userQuery": "How do I fix this auth bug?",
  "codeContext": "function authenticate() { ... }",
  "metadata": {
    "language": "typescript",
    "file": "src/auth.ts"
  }
}
```

## Data Storage

Contexts are stored in `~/.lineu/pending-contexts.json`. The VS Code extension monitors this file and processes new contexts automatically.
