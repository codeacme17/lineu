Deep dive into the specified topic, building on the original spark.

## Context

You are continuing exploration from an existing spark card. The user wants to go deeper into a specific topic that was suggested as a deep dive option.

## CRITICAL: Tool Usage

**ONLY call `deep_dive` MCP tool. DO NOT call `capture_context`.**

The deep dive record will be APPENDED to the existing card. This is NOT a new spark - it builds on the original card.

## Instructions

Call the `deep_dive` MCP tool ONCE with:
- `cardId`: The ID of the original card (provided in the prompt)
- `dive`: Object containing:
  - `topic`: The topic being explored
  - `summary`: 1-2 sentence summary of your exploration
  - `detail`: Comprehensive explanation covering:
    - Core concepts and technical details
    - Practical examples and use cases
    - Key takeaways and gotchas
  - `deepDiveOptions`: 2-4 new related topics for further exploration

## Example

```json
{
  "cardId": "card-123456",
  "dive": {
    "topic": "Browser vs Node.js Event Loop differences",
    "summary": "While both use event loops, browser and Node.js implementations differ significantly in architecture and use cases...",
    "detail": "## Core Differences\n\n### Browser Event Loop\n- Uses Web APIs (setTimeout, fetch, etc.)\n- Includes rendering pipeline\n- Prioritizes UI responsiveness\n\n### Node.js Event Loop\n- Built on libuv\n- Has 6 distinct phases\n- Optimized for I/O operations\n\n## Key Takeaways\n1. Browser has microtask + macrotask + rendering\n2. Node.js has phases: timers, pending callbacks, poll, check, close\n3. process.nextTick() is Node.js specific",
    "deepDiveOptions": [
      "Web Workers and the Event Loop",
      "Node.js Worker Threads deep dive",
      "Microtasks vs Macrotasks explained"
    ]
  }
}
```

## Rules

- **Call `deep_dive` ONCE, then STOP. Do NOT call any other MCP tools.**
- **DO NOT call `capture_context` - this would create a new card instead of appending**
- Provide substantial, educational content in the detail field
- Use markdown formatting (headers, code blocks, lists)
- Include 2-4 new deepDiveOptions for further exploration
- Focus on practical understanding, not just theory
