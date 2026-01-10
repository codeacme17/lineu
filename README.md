# Lineu

**Learn from Vibe-Coding**

An invisible learning recorder for developers who ship fast with AI—turning skipped knowledge moments into replayable learning assets.

## The Problem

AI-assisted coding has fundamentally changed how developers work. We ship faster than ever, solving problems in minutes that once took hours. But there's a hidden cost.

**Vibe-Coding Effects**: When you're in flow with an AI assistant, you're optimizing for output, not understanding. You accept solutions without digging into the "why." You fix bugs without truly grasping the root cause. Over time, this creates a widening gap between what you've built and what you actually know.

The result? A growing sense of cognitive emptiness. You've shipped a lot, but you're not sure you've learned much.

Lineu doesn't ask you to slow down. It coexists with your vibe-coding workflow—capturing the knowledge moments you'd otherwise lose, and returning them to you when you're ready.

## What Lineu Does

- **Detect** — Automatically identify learning-value moments in your AI-assisted coding sessions
- **Capture** — Structure them into digestible knowledge units called *Lineu Cards*
- **Return** — Surface these cards at natural pause points, giving you the choice to learn—without interrupting your flow

## Key Concepts

### Lineu Cards

A Lineu Card represents a single piece of knowledge that was skipped during vibe-coding but has lasting value. Cards come in two types:

**Learn Knowledge**
Tech stack decisions, architecture choices, concepts you accepted without digging deeper.
*"Why did the AI recommend this framework? What are the tradeoffs?"*

**Learn Bug Cases**
Bugs you fixed without fully understanding, patterns worth recognizing next time.
*"What actually caused this error? How do I spot it earlier?"*

### VCO (Vibe-Coding Session)

A continuous, high-density conversation with AI focused on shipping. Fast questions, fast answers, minimal reflection. This is where Lineu silently captures learning opportunities.

## How It Works

1. **You vibe-code** — Lineu stays silent in the background
2. **You pause** — Lineu surfaces the cards it captured
3. **You choose** — Keep what interests you, discard the rest
4. **You learn (or don't)** — Dive deeper anytime, or never—no pressure

## Philosophy

What Lineu does **not** do:

- Force you to learn
- Interrupt your coding flow
- Become a course platform
- Use anxiety or guilt to drive engagement

*Lineu doesn't fight vibe-coding—it coexists with it.*

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode (development)
pnpm watch
```

## Project Structure

```
packages/
├── lib/              # @lineu/lib - Core card generation logic
├── mcp-server/       # @lineu/mcp-server - MCP server for context capture
└── vscode-extension/ # VSCode extension for card generation
```

## Development

See [CLAUDE.md](./CLAUDE.md) for detailed development documentation, including per-package commands, MCP server configuration, and architecture details.
