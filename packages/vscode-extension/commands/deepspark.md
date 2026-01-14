Deep dive into this topic. Explain:
1. **Why** - Underlying reason/motivation
2. **How** - Mechanism/implementation details
3. **When** - Best use cases and when to avoid
4. **What if** - Edge cases, limitations, alternatives

Then call capture_context MCP tool ONCE with ALL these parameters:
- action: "deepspark"
- cardId: [the card ID from context]
- type: "knowledge"
- seedText: comprehensive summary of deep dive
- rawConversation: COMPLETE conversation including this deep dive
- pushToExtension: true  ← REQUIRED, must be true

IMPORTANT: Call exactly ONCE. pushToExtension MUST be true.
