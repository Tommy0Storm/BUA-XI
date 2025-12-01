# Voice Pipeline Improvements (2025)

## Changes Made

### 1. GoAway Message Handling
Added handling for server `goAway` messages which signal imminent disconnection.
- Logs the goAway reason
- Initiates preemptive reconnection before grace period ends
- Prevents unexpected disconnects from interrupting user experience

### 2. ToolCallCancellation Handling  
Added handling for `toolCallCancellation` messages.
- Logs cancelled tool call IDs
- Currently informational (tools execute immediately)
- Future: could add pending tool tracking for actual cancellation

### 3. Enhanced Error Classification
Improved `onerror` handler with structured error handling based on status codes:
- **401/403**: Auth failure → blacklist key
- **429**: Rate limit → exponential backoff (up to 30s), no blacklist
- **404**: Model not found → log compatibility warning
- **400**: Invalid request → log for debugging
- **Network errors**: Retry without blacklisting

### 4. Buffer Size Decision
Kept AudioWorklet buffer at 256 samples (vs Context7 reference of 2048).
- 256 = ~16ms latency at 16kHz (optimal for real-time voice)
- 2048 = ~128ms latency (too sluggish for interactive voice)
- Trade-off: More messages but lower latency (correct for voice chat)

## Code Locations

- `hooks/useGeminiLive.ts` lines ~1463-1500: goAway/toolCallCancellation handlers
- `hooks/useGeminiLive.ts` lines ~1567-1600: Enhanced onerror handler

## Future Enhancements

### Session Resumption (Not Yet Implemented)
The SDK supports `SessionResumptionConfig` with:
- `handle`: Token from previous session's `SessionResumptionUpdate`
- `transparent`: Boolean for seamless resume

Implementation would require:
1. Store `newHandle` from `SessionResumptionUpdate` messages
2. Pass handle in `sessionResumption` config on reconnect
3. Handle non-resumable states gracefully

### Pending Tool Tracking
To fully utilize toolCallCancellation:
1. Track in-flight tool calls by ID
2. Use AbortController for cancellable operations
3. Cancel on toolCallCancellation receipt
