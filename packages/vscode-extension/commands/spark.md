Call capture_context MCP tool ONCE to record this conversation.

Parameters:
- type: "bug" | "best_practice" | "knowledge" (choose based on conversation)
- seedText: 2-4 sentence summary of key knowledge points
- rawConversation: COMPLETE conversation snapshot including:
  - All user messages
  - All your (AI) responses
  - Format: "User: ...\nAssistant: ...\nUser: ...\nAssistant: ..."
- pushToExtension: true

IMPORTANT: Call this tool exactly ONCE. Do not call it multiple times.
