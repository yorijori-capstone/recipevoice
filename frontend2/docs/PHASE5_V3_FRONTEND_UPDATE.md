# Phase 5 V3: Frontend Update for MCP Tool Calling

## Overview
Frontend를 MCP Tool Calling 아키텍처에 맞게 업데이트합니다.
LangChain 관련 코드를 제거하고 `tool_executed` 이벤트를 처리합니다.

## Changes

### 1. useWebSocket.ts
**LangChain → MCP 이벤트 변경**

Before:
```typescript
// V2 events
onLangChainResponse?: (result: any) => void;
```

After:
```typescript
// V3 events (MCP Tool Calling)
onToolExecuted?: (data: { tool: string; result: any }) => void;
```

**이벤트 핸들러 변경**:
```typescript
case 'tool_executed':
  console.log('🔧 [useWebSocket] Tool executed:', data.tool, data.result);
  if (options.onToolExecuted) {
    options.onToolExecuted({ tool: data.tool, result: data.result });
  }
  break;
```

### 2. VoiceInteraction.tsx
**Props 주석 업데이트**:
```typescript
onStepAutoChanged?: (data: any) => void;  // V3: Auto step change from MCP Tool
onSessionStateUpdated?: (data: any) => void;  // V3: Session state sync
```

**MCP Tool 이벤트 핸들러**:
```typescript
onToolExecuted: ({ tool, result }) => {
  console.log('🔧 [VoiceInteraction] MCP Tool executed:', tool, result);

  // Handle navigation tools
  if (tool === 'navigate_next_step' || tool === 'navigate_previous_step' || tool === 'navigate_to_step') {
    onStepAutoChanged?.(result);
  }
  // Handle timer tools
  else if (tool === 'start_timer') {
    onCommandDetected?.('start_timer');
  } else if (tool === 'stop_timer') {
    onCommandDetected?.('stop_timer');
  }
},
```

### 3. CookingMode.tsx
**주석 업데이트**:
```typescript
// V3: Handle auto step change from MCP Tool Calling
const handleStepAutoChanged = (data: any) => {
  console.log('[CookingMode] Step auto-changed by MCP Tool:', data);
  if (data?.current_step_index !== undefined) {
    console.log(`✨ Auto-moved to step: ${data.current_step_index + 1}`);
  }
};
```

### 4. useCookingSessionV2.ts
**Voice Mode API 호출 제거** (Backend에서 이미 제거됨):
```typescript
/**
 * Set voice mode (V3: Local state only, no backend API)
 */
const setVoiceMode = useCallback(
  async (mode: 'none' | 'auto' | 'manual') => {
    // V3: Voice mode is managed locally in VoiceInteraction component
    // No backend API call needed
    setSession((prev) =>
      prev ? { ...prev, voiceMode: mode } : null
    );
  },
  [session]
);
```

## MCP Tool Names Mapping

| MCP Tool | Action |
|----------|--------|
| `navigate_next_step` | 다음 단계로 이동 |
| `navigate_previous_step` | 이전 단계로 이동 |
| `navigate_to_step` | 특정 단계로 이동 |
| `start_timer` | 타이머 시작 |
| `stop_timer` | 타이머 정지 |
| `check_timer` | 타이머 상태 확인 |

## Data Flow (V3)

```
Backend (MCP Tool Executed)
    ↓
WebSocket: { type: 'tool_executed', tool: 'navigate_next_step', result: {...} }
    ↓
useWebSocket → onToolExecuted callback
    ↓
VoiceInteraction → onStepAutoChanged / onCommandDetected
    ↓
CookingMode → UI Update
```

## Testing

```bash
cd frontend2
npm run build  # Success!
```

## Next Steps
- Phase 6: V2 → V3 naming (코드 내용 변경 없이 파일/클래스명만 변경)
