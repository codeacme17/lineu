# Knowledge Cards - VSCode Extension

A VSCode extension for generating draw-style knowledge cards from context and git diff.

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

The extension requires `@lineu/mcp-server`. It will look for the server in:

1. User-configured `cards.mcpServerPath`
2. Bundled server in extension
3. Global npm: `npm install -g @lineu/mcp-server`
4. Local node_modules
