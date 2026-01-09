# @lineu/mcp-server

MCP (Model Context Protocol) Server for Knowledge Cards.

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build
pnpm build

# Watch mode
pnpm watch

# Run locally
node dist/index.js
```

Then you can setting up your client (e.g., Cursor, Claude Desktop) to point to the local server.

### In Cursor

Edit `~/.cursor/mcp.json`:

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

After editing, **restart Cursor** to apply changes.

### In Claude Desktop

Add to `claude_desktop_config.json`:

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

## Usage

### As CLI

```bash
# Global install
npm install -g @lineu/mcp-server

# Run
lineu-mcp-server
```

### As npx

```bash
npx @lineu/mcp-server
```

### After Publishing to npm

Once published, you can use npx instead:

```json
{
  "mcpServers": {
    "lineu": {
      "command": "npx",
      "args": ["@lineu/mcp-server"]
    }
  }
}
```

## Publish

```bash
# Build
pnpm build

# Publish to npm
pnpm publish --access public
```
