# Tool Calling System

## Available Tools (LIVE_API_TOOLS)

### High Priority Tools
| Tool | Purpose | Auto-Offer |
|------|---------|------------|
| `send_email` | Send comprehensive emails with context | YES - after directions/search/advice |
| `open_maps` | Google Maps directions | YES - offer to email after |
| `google_search` | Web search grounding | YES - offer to email results |
| `query_lra_document` | Legal document queries (LRA 2025) | When legal question detected |

### Medium Priority Tools
| Tool | Purpose | Trigger |
|------|---------|---------|
| `make_call` | Phone dialer | "call", "phone", "ring" |
| `open_whatsapp` | WhatsApp messaging | "WhatsApp", "message" |
| `fetch_url_content` | Web page scraping | User shares link |

### Utility Tools
| Tool | Purpose |
|------|---------|
| `copy_to_clipboard` | Copy text for pasting |
| `set_reminder` | Browser notifications |
| `send_sms` | SMS app opening |
| `create_calendar_event` | Google Calendar |
| `share_content` | Native share API |
| `prompt_screen_share` | Request screen share |
| `prompt_camera_share` | Request camera access |
| `request_location` | Request GPS location |
| `report_language_change` | Language detection (auto) |

## Tool Response Pattern
```typescript
// After tool execution, send response back to model
session.sendToolResponse({
  functionResponses: [{
    id: call.id,
    name: call.name,
    response: { 
      result: 'Success message with actionable follow-up',
      // Optional: scheduling: 'INTERRUPT' | 'WHEN_IDLE' | 'SILENT'
    }
  }]
})
```

## Tool Call Handling Flow
```typescript
// In onmessage callback
if (msg.toolCall?.functionCalls?.length) {
  for (const call of msg.toolCall.functionCalls) {
    // 1. Log the tool call
    dispatchLog('info', 'Tool Called', call.name)
    
    // 2. Execute tool-specific logic
    const result = await executeToolLogic(call)
    
    // 3. Send response back to model
    session.sendToolResponse({
      functionResponses: [{
        id: call.id,
        name: call.name,
        response: { result }
      }]
    })
  }
}
```

## Email Context Aggregation
The `send_email` tool automatically includes:
1. AI's provided body content
2. Recent maps/directions (within 2 minutes)
3. Recent search queries (within 2 minutes)
4. Fetched URL content (within 2 minutes)
5. Conversation context
6. User location (if available)

## Processing Feedback (CRITICAL)
When ANY tool is called, the AI MUST acknowledge verbally FIRST:
- "One sec, let me do that for you..."
- "Just sorting that out..."
- "Busy with that now..."

NEVER go silent while processing tools.
