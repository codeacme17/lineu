Review this vibe coding session and extract deep insights as knowledge cards.

## Required Coverage (3 Angles)

You MUST generate cards covering these perspectives:

1. **Knowledge** (type: `knowledge`) - REQUIRED
   - What concepts were learned? How does it work under the hood?
   - Technical understanding, mental models, TIL moments
   
2. **Best Practice** (type: `best_practice`) - REQUIRED  
   - What's the recommended approach? Any improvement suggestions?
   - Better patterns, refactoring ideas, architectural insights

3. **Bug** (type: `bug`) - IF APPLICABLE
   - Any problems found, potential issues, debugging insights?
   - Skip if no bugs/issues were discussed

## Card Types Reference

| Type | What to Capture | Example Titles |
|------|-----------------|----------------|
| `bug` | Root cause, debugging process, fix explanation | "Race condition in useEffect cleanup", "Memory leak from unsubscribed listeners" |
| `knowledge` | How things work, concepts, technical deep-dives | "How React Suspense handles loading states", "Event loop and microtasks explained" |
| `best_practice` | Patterns, conventions, improvement suggestions | "Extract custom hook for data fetching", "Use discriminated unions for type safety" |

## Instructions

Call capture_context MCP tool ONCE with multiple cards:

```
{
  "cards": [
    { "type": "knowledge", "title": "...", "summary": "...", "detail": "...", "tags": [...] },
    { "type": "best_practice", "title": "...", "summary": "...", "detail": "...", "tags": [...] },
    { "type": "bug", "title": "...", ... }  // if applicable
  ],
  "rawConversation": "Full conversation (user + assistant messages)"
}
```

## Rules

- Generate 2-7 cards: at minimum 1 knowledge + 1 best_practice
- Add bug cards only if actual issues were discussed
- Each card should have substantial detail, not surface-level observations
- Maximum 2 tags per card
- Include BOTH user messages AND assistant responses in rawConversation
