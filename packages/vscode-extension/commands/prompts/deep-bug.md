Analyze this bug in depth to prevent similar issues.

## Analysis Framework

1. **Root Cause** - Why did this bug happen? What's the underlying issue?
2. **Fix Explanation** - How does the solution work? Why is it correct?
3. **Prevention** - How to avoid this bug in the future? What patterns help?
4. **Related Gotchas** - Similar bugs to watch out for

## Context

Topic: {{cardInfo}}

Background:
{{context}}
--- END OF ORIGINAL CONTEXT ---

## Instructions

After your analysis, call capture_context with:

```json
{
  "cards": [{
    "type": "bug",
    "title": "Deep Dive: [Bug Topic]",
    "summary": "One sentence on root cause and fix",
    "detail": "Markdown covering all 4 analysis points with code examples",
    "tags": ["max", "2"]
  }],
  "rawConversation": "Copy ONLY the Background section above"
}
```

Call exactly ONCE.
