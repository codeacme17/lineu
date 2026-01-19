Extract a DIFFERENT insight from this conversation.

The previous card focused on one angle. Now find another valuable perspective:

- Alternative approaches or trade-offs discussed
- Related concepts that weren't highlighted
- Edge cases, gotchas, or caveats mentioned
- Practical lessons that could be separate cards

## Context

Original card: {{cardInfo}}

Background:
{{context}}
--- END OF ORIGINAL CONTEXT ---

## Instructions

Call capture_context with a NEW card (different angle):

```json
{
  "cards": [{
    "type": "bug" | "best_practice" | "knowledge",
    "title": "Different angle title (5-10 words)",
    "summary": "One sentence with the new insight",
    "detail": "Markdown explanation with examples",
    "tags": ["max", "2"]
  }],
  "rawConversation": "Copy ONLY the Background section above"
}
```

Call exactly ONCE.
