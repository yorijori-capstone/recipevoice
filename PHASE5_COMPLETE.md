# Phase 5 Complete: Backend Integration ✅

**Status**: ✅ 완료
**Date**: 2025-11-21

## 📋 Overview

Phase 5에서는 Backend를 새 V2 아키텍처로 통합했습니다:
- ✅ CookingServiceV2 기반 API Routes 생성
- ✅ WebSocket 핸들러 RealtimeServiceV2로 업데이트
- ✅ Session State 실시간 브로드캐스팅
- ✅ LangChain 응답 처리
- ✅ 빌드 성공 확인

---

## 🆕 New Backend Components

### 1. CookingV2 Routes (`src/routes/cookingV2.ts`)

**Purpose**: V2 아키텍처용 API 엔드포인트

**Key Endpoints**:
```
POST   /api/cooking/v2/start
GET    /api/cooking/v2/session/:sessionId
POST   /api/cooking/v2/session/:sessionId/next
POST   /api/cooking/v2/session/:sessionId/previous
POST   /api/cooking/v2/session/:sessionId/voice-mode
POST   /api/cooking/v2/session/:sessionId/end
GET    /api/cooking/v2/session/:sessionId/history
GET    /api/cooking/v2/health
```

**Major Changes from V1**:
- ✅ Uses CleanedRecipeService (no planning delay)
- ✅ Returns `cleanedRecipeId` in session
- ✅ Includes `openingRemark` and `closingRemark`
- ✅ Supports voice mode management
- ✅ Provides session history endpoint

**Example Response**:
```json
{
  "success": true,
  "session": {
    "sessionId": "session_1234567890_abc123",
    "recipeId": "recipe_gen_1234567890",
    "cleanedRecipeId": 42,
    "title": "김치찌개",
    "openingRemark": "안녕하세요! 김치찌개 만들기를 시작하겠습니다.",
    "totalSteps": 8,
    "currentStepIndex": 0,
    "viewingStepIndex": 0,
    "status": "active",
    "voiceMode": "none",
    "plannedSteps": [...]
  }
}
```

---

### 2. ServerV2 (`src/serverV2.ts`)

**Purpose**: V2 아키텍처용 WebSocket 서버

**Architecture**:
```
Client WebSocket
    ↓
ServerV2 WebSocket Handler
    ↓
├─ RealtimeServiceV2 (OpenAI Realtime API)
│  └─ LangChain Agent (Intent Detection + Tool Execution)
│     └─ CookingAgentV2 (Session Management)
│        └─ SessionService (Database Persistence)
└─ Event Broadcasting (Real-time State Updates)
```

**Key Features**:

#### 1. Session Initialization
```javascript
// Frontend sends
{ type: 'init_session', sessionId: 'session_xxx' }

// Server responds
{ type: 'session_initialized', sessionId: 'session_xxx', version: 'v2' }
```

#### 2. LangChain Integration
- User voice → Transcription → LangChain Agent → Intent Detection
- Automatic tool execution (next_step, timer, etc.)
- Response generation with context

```javascript
// LangChain response event
{
  type: 'langchain_response',
  sessionId: 'session_xxx',
  result: {
    success: true,
    data: { step: {...} },
    responseText: '다음 단계로 이동합니다...'
  }
}
```

#### 3. Real-time State Broadcasting
- Step changed → `step_changed` event
- Voice mode changed → `voice_mode_changed` event
- Session ended → `session_ended` event

```javascript
// Step changed event
{
  type: 'step_changed',
  sessionId: 'session_xxx',
  stepIndex: 2,
  step: {
    order: 3,
    script: '...',
    timer_required: true,
    ...
  }
}
```

#### 4. Manual Step Navigation (NEW!)
Frontend can now manually control steps via WebSocket:

```javascript
// Frontend sends
{ type: 'next_step' }
{ type: 'previous_step' }

// Server responds with step_changed event
```

---

### 3. Event Flow Diagram

**User Voice Input Flow**:
```
1. User speaks → Audio data sent via WebSocket
2. OpenAI Realtime API → Transcription
3. RealtimeServiceV2 → LangChain Agent
4. LangChain Agent → Intent Detection (GPT-3.5)
5. LangChain Agent → Tool Execution (CookingAgentV2)
6. CookingAgentV2 → SessionService (DB update)
7. SessionService → State logged
8. RealtimeServiceV2 → Broadcast to WebSocket clients
9. Frontend → UI update
```

**Manual Navigation Flow**:
```
1. User clicks "Next" button
2. Frontend sends { type: 'next_step' }
3. ServerV2 → CookingAgentV2.nextStep()
4. CookingAgentV2 → SessionService.updateSession()
5. SessionService → DB update + state log
6. ServerV2 → Broadcast step_changed event
7. Frontend → UI update
```

---

## 📊 API Comparison

### V1 vs V2 Endpoints

| Feature | V1 Endpoint | V2 Endpoint | Difference |
|---------|-------------|-------------|------------|
| Start Session | `POST /api/cooking/start` | `POST /api/cooking/v2/start` | V2 uses cleaned recipes (faster) |
| Get Session | `GET /api/cooking/session/:id` | `GET /api/cooking/v2/session/:id` | V2 includes cleanedRecipeId |
| Next Step | `POST /api/cooking/session/:id/next` | `POST /api/cooking/v2/session/:id/next` | V2 persists to DB |
| Voice Mode | ❌ Not available | `POST /api/cooking/v2/session/:id/voice-mode` | V2 only |
| History | ❌ Not available | `GET /api/cooking/v2/session/:id/history` | V2 only |

---

## 🔄 WebSocket Events

### Events Sent from Server to Client

| Event Type | Description | Payload |
|------------|-------------|---------|
| `session_initialized` | Session ready for cooking | `{ sessionId, version }` |
| `user_transcription` | User voice transcribed | `{ transcript }` |
| `assistant_transcript_delta` | AI response streaming | `{ delta }` |
| `assistant_transcript_done` | AI response complete | `{ transcript }` |
| `audio_delta` | TTS audio chunk | `{ audio }` |
| `langchain_response` | LangChain processing result | `{ sessionId, result }` |
| `step_changed` | Step navigation occurred | `{ sessionId, stepIndex, step }` |
| `voice_mode_changed` | Voice mode updated | `{ sessionId, mode }` |
| `session_state_updated` | Session state changed | `{ sessionId, currentStepIndex, ... }` |
| `session_ended` | Session completed | `{ sessionId }` |
| `error` | Error occurred | `{ error }` |

### Events Sent from Client to Server

| Event Type | Description | Payload |
|------------|-------------|---------|
| `init_session` | Initialize session | `{ sessionId }` |
| `audio` | Audio data chunk | `{ audio }` |
| `start_streaming` | Start audio streaming | `{}` |
| `stop_streaming` | Stop audio streaming | `{}` |
| `set_vad_mode` | Change VAD mode | `{ mode }` |
| `send_text` | Send text for TTS | `{ text }` |
| `next_step` | Navigate to next step | `{}` |
| `previous_step` | Navigate to previous step | `{}` |

---

## 🚀 Running the Server

### Development Mode

**V1 Server (Legacy)**:
```bash
npm run dev
# Runs on port 3001
```

**V2 Server (New Architecture)**:
```bash
npm run dev:v2
# Runs on port 3001
```

### Production Mode

**Build**:
```bash
npm run build
```

**Start V1**:
```bash
npm start
```

**Start V2**:
```bash
npm start:v2
```

---

## 🧪 Testing Guide

### 1. Test Session Creation (V2 API)

```bash
curl -X POST http://localhost:3001/api/cooking/v2/start \
  -H "Content-Type: application/json" \
  -d '{"recipeId": "recipe_gen_1234567890"}'
```

**Expected Response**:
```json
{
  "success": true,
  "session": {
    "sessionId": "session_xxx",
    "cleanedRecipeId": 42,
    "title": "김치찌개",
    "openingRemark": "안녕하세요! ...",
    "totalSteps": 8,
    ...
  }
}
```

### 2. Test WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3001');

// Initialize session
ws.send(JSON.stringify({
  type: 'init_session',
  sessionId: 'session_xxx'
}));

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type);
};
```

### 3. Test LangChain Integration

1. Start V2 server: `npm run dev:v2`
2. Connect via WebSocket
3. Send voice command: "다음 단계"
4. Expected events:
   - `user_transcription`: "다음 단계"
   - `langchain_response`: Intent detected as NEXT_STEP
   - `step_changed`: Step index incremented
   - `assistant_transcript_done`: "다음 단계로 이동합니다..."

### 4. Test Manual Navigation

```javascript
// Send next step command
ws.send(JSON.stringify({ type: 'next_step' }));

// Expected response
{
  type: 'step_changed',
  sessionId: 'session_xxx',
  stepIndex: 1,
  step: { ... }
}
```

---

## 🔍 Debugging

### Enable Debug Logs

Add to your `.env`:
```
DEBUG=true
```

### Check Session State in Database

```sql
-- Get session info
SELECT * FROM cooking_sessions WHERE session_id = 'session_xxx';

-- Get session history
SELECT * FROM session_states
WHERE session_id = 'session_xxx'
ORDER BY created_at DESC
LIMIT 10;
```

### WebSocket Connection Issues

1. Check server is running: `curl http://localhost:3001/health`
2. Check V2 health: `curl http://localhost:3001/api/cooking/v2/health`
3. Check WebSocket connection: Use browser DevTools → Network → WS

---

## 📝 Migration Notes

### For Frontend Developers

**Old Code (V1)**:
```javascript
// Start session
const response = await fetch('/api/cooking/start', {
  method: 'POST',
  body: JSON.stringify({ recipeId })
});
```

**New Code (V2)**:
```javascript
// Start session
const response = await fetch('/api/cooking/v2/start', {
  method: 'POST',
  body: JSON.stringify({ recipeId })
});

// Response includes cleanedRecipeId and openingRemark
const { session } = await response.json();
console.log(session.openingRemark); // "안녕하세요! ..."
```

**WebSocket Events (NEW)**:
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'langchain_response':
      // LangChain processed user intent
      console.log('Intent result:', data.result);
      break;

    case 'step_changed':
      // Step navigation occurred
      updateUI(data.stepIndex, data.step);
      break;

    case 'session_state_updated':
      // Session state changed
      updateSessionState(data);
      break;
  }
};
```

---

## ✅ Checklist

**Backend (Server)**:
- [x] serverV2.ts created
- [x] cookingV2.ts routes created
- [x] WebSocket handlers updated for RealtimeServiceV2
- [x] LangChain response event handling
- [x] Session state broadcasting
- [x] Manual navigation support
- [x] Build succeeds
- [x] Health check endpoints

**API Endpoints**:
- [x] POST /api/cooking/v2/start
- [x] GET /api/cooking/v2/session/:id
- [x] POST /api/cooking/v2/session/:id/next
- [x] POST /api/cooking/v2/session/:id/previous
- [x] POST /api/cooking/v2/session/:id/voice-mode
- [x] POST /api/cooking/v2/session/:id/end
- [x] GET /api/cooking/v2/session/:id/history
- [x] GET /api/cooking/v2/health

**WebSocket Events**:
- [x] init_session
- [x] audio streaming
- [x] VAD mode control
- [x] Manual step navigation
- [x] LangChain response broadcasting
- [x] Session state broadcasting

---

## 🎯 Phase 5 Status: COMPLETE

**All backend integration tasks completed successfully!**

### Next Steps (Phase 6: Frontend Integration)

1. **Update Dashboard.tsx**:
   - Use `/api/cooking/v2/start` endpoint
   - Display `openingRemark`
   - Handle `cleanedRecipeId`

2. **Update CookingMode.tsx**:
   - Connect to V2 WebSocket events
   - Handle `langchain_response` events
   - Handle `step_changed` events
   - Implement session state recovery

3. **Add Session Recovery**:
   - Store `sessionId` in localStorage
   - Check for existing session on mount
   - Restore session from database

Ready for Phase 6! 🚀
