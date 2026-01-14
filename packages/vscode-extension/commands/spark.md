Call capture_context MCP tool ONCE to record this conversation.

You MUST include ALL of these parameters:
- type: "bug" | "best_practice" | "knowledge" (choose based on conversation)
- title: Short title (5-10 words)
- summary: Brief summary (1-2 sentences)
- detail: Detailed explanation with context and examples
- tags: 1-2 tags for categorization (MAXIMUM 2 tags!)
- rawConversation: COMPLETE conversation history "User: ...\nAssistant: ..."
- pushToExtension: true ← REQUIRED

IMPORTANT: 
- Call this tool exactly ONCE
- pushToExtension MUST be true for the card to appear
- tags: MAXIMUM 2 tags only!
