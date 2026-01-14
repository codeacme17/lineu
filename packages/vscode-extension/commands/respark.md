Generate a DIFFERENT perspective from the same conversation.

Focus on:
- Alternative approaches mentioned
- Trade-offs discussed
- Related concepts not highlighted
- Edge cases or gotchas

Then call capture_context MCP tool ONCE with:
- action: "respark"
- cardId: [the card ID from context]
- type: appropriate type
- seedText: fresh summary with new angle
- rawConversation: COMPLETE conversation (User + Assistant messages)
- pushToExtension: true

IMPORTANT: Call this tool exactly ONCE.
