Generate a DIFFERENT perspective from the same conversation.

Focus on:
- Alternative approaches mentioned
- Trade-offs discussed  
- Related concepts not highlighted
- Edge cases or gotchas

Then call capture_context MCP tool ONCE with ALL these parameters:
- action: "respark"
- cardId: [the card ID from context]
- type: appropriate type
- seedText: fresh summary with new angle
- rawConversation: COMPLETE conversation history in format "User: ...\nAssistant: ..."
- pushToExtension: true  ← REQUIRED, must be true

IMPORTANT: Call exactly ONCE. pushToExtension MUST be true.
