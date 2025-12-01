# Task Completion Checklist

## Before Committing Changes

### 1. Code Quality
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No console.error or console.warn in production paths
- [ ] All refs properly guarded with `isConnectedRef.current`
- [ ] Async operations have try/catch blocks

### 2. Audio Pipeline Integrity
- [ ] Input sample rate is 16000 (NEVER change)
- [ ] Output sample rate is 24000 (NEVER change)
- [ ] PCM encoding is 16-bit signed little-endian
- [ ] Normalization targetRms is 0.1 (input) / 0.09 (output)

### 3. Session Safety
- [ ] All `session.send*` calls guarded by `isConnectedRef.current`
- [ ] Proper cleanup in disconnect handlers
- [ ] No memory leaks (clear intervals, disconnect nodes)

### 4. Tool Handling
- [ ] All tool responses sent back to model
- [ ] Tool execution has verbal acknowledgment
- [ ] Error cases handled gracefully

### 5. Testing
- [ ] Test voice input/output in browser
- [ ] Test camera toggle
- [ ] Test tool calls (especially email)
- [ ] Test disconnect/reconnect flow
- [ ] Test on mobile (touch targets, safe areas)

## After Making Changes

### Run These Commands
```powershell
# 1. Type check
npx tsc --noEmit

# 2. Build test
npm run build

# 3. Dev server test
npm run dev
# Then test in browser at localhost:5173
```

### Git Workflow
```powershell
git status
git add .
git commit -m "feat: description of change"
git push
```

## Common Issues to Check

### Audio Not Working
1. Check AudioContext state (needs user gesture)
2. Verify `safeToSpeakRef.current` is true
3. Check `isMicMuted` / `isMuted` state
4. Verify worklet is connected

### Connection Drops
1. Check API key validity
2. Look for auth errors in console
3. Verify model name is correct
4. Check for network issues

### Tools Not Executing
1. Verify tool response is sent
2. Check tool call args parsing
3. Look for errors in tool handler
