Generate a DIFFERENT perspective from the same conversation.

Focus on:
- Alternative approaches mentioned
- Trade-offs discussed  
- Related concepts not highlighted
- Edge cases or gotchas

Then call capture_context MCP tool ONCE with ALL these parameters:
- type: appropriate type ("bug" | "best_practice" | "knowledge")
- title: Short title with NEW angle (5-10 words)
- summary: Fresh summary highlighting different aspect (1-2 sentences)
- detail: Detailed explanation of the alternative perspective
- tags: 1-2 tags (MAXIMUM 2!)
- rawConversation: COMPLETE conversation history "User: ...\nAssistant: ..."

IMPORTANT: Call exactly ONCE. Maximum 2 tags!
