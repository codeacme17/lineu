Review this vibe coding session and capture insights as knowledge cards.

Analyze the conversation and code changes to extract:
1. **Code Issues** (type: `bug`) - Problems found, potential bugs, things that need fixing
2. **Knowledge Gained** (type: `knowledge`) - Concepts learned, how things work, technical understanding
3. **Improvement Ideas** (type: `best_practice`) - Better patterns, refactoring suggestions, recommended approaches

## Card Types

| Type | What to Capture | Example Titles |
|------|-----------------|----------------|
| `bug` | Problem root cause, debugging insights, fixes needed | "Race condition in useEffect cleanup", "Memory leak from unsubscribed listeners" |
| `knowledge` | How something works, concepts explained, TIL moments | "How React Suspense handles loading states", "Difference between useMemo and useCallback" |
| `best_practice` | Better patterns, code improvements, architectural suggestions | "Extract custom hook for data fetching", "Use discriminated unions for type safety" |

## Instructions

Call capture_context MCP tool ONCE with multiple cards:

```
{
  "cards": [
    {
      "type": "bug" | "best_practice" | "knowledge",
      "title": "Concise title (5-10 words)",
      "summary": "One sentence TL;DR",
      "detail": "Markdown: context → problem/concept → solution/explanation → examples",
      "tags": ["tag1", "tag2"]  // MAX 2
    },
    // ... more cards
  ],
  "rawConversation": "Full conversation (user + assistant messages)"
}
```

## Rules

- Generate 1-7 cards based on conversation richness
- Each insight should be a separate card with appropriate type
- Maximum 2 tags per card
- Include BOTH user messages AND assistant responses in rawConversation
- Prioritize actionable insights over trivial observations
