# Lineu

## Structure

```
packages/
├── lib/              # Shared library (internal)
├── mcp-server/       # @lineu/mcp-server (npm package)
└── vscode-extension/ # VSCode extension
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode (development)
pnpm watch
```

## Packages

### @lineu/mcp-server

```bash
# Build
pnpm --filter @lineu/mcp-server build

# Run
node packages/mcp-server/dist/index.js
```

### VSCode Extension

```bash
# Build
pnpm --filter vscode-knowledge-cards build

# Package .vsix
cd packages/vscode-extension && pnpm package
```

## Development

1. Open in VSCode
2. Run `pnpm install && pnpm build`
3. Press `F5` to launch Extension Development Host
