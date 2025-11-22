# Phase 4 V3: Remove LangChain Dependencies

## Overview
LangChain을 완전히 제거하고 MCP Tool Calling만 사용하는 순수한 V3 아키텍처로 전환합니다.

## Changes

### 1. RealtimeServiceV2 수정
- LangChainAgent import 제거
- langChainAgent 프로퍼티 제거
- conversationHistory 프로퍼티 제거
- processUserTranscript() 메서드 제거
- MCP Tool Calling만 사용

### 2. CookingServiceV2 수정
- LangChainAgent import 제거
- langChainAgent 인스턴스 제거
- getLangChainAgent() 메서드 제거

### 3. 파일 삭제
- `src/agents/langchainAgent.ts` 완전 삭제

### 4. Package.json 수정
제거된 패키지:
```json
"@langchain/openai": "^1.1.2"
"langchain": "^1.0.6"
```

추가된 패키지 (LangChain의 dependency였던 것):
```json
"openai": "^4.x.x"
```

## Architecture After Phase 4

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
└─────────────────────────────┬───────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     serverV2.ts                             │
│  - /ws/voice WebSocket endpoint                             │
│  - tool_executed broadcast                                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CookingServiceV2                          │
│  - CookingAgentV2 (recipe/session management)               │
│  - RealtimeServiceV2 (voice/MCP)                            │
│  - MCPClientManager (tool routing)                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐
│  Navigation     │ │    Timer        │ │  PostgreSQL │
│  MCP Server     │ │  MCP Server     │ │  Database   │
└─────────────────┘ └─────────────────┘ └─────────────┘
```

## Removed Components

```
❌ LangChainAgent (langchainAgent.ts)
❌ conversationHistory (RealtimeServiceV2)
❌ processUserTranscript() (RealtimeServiceV2)
❌ @langchain/openai package
❌ langchain package
```

## Data Flow (V3 Pure Architecture)

```
User Voice → Whisper STT (Korean) → Transcript
     ↓
OpenAI Realtime API (Intent Detection)
     ↓
Tool Call Required?
     ├─ Yes → MCP Client → MCP Server → PostgreSQL
     │                          ↓
     │                    Tool Result
     │                          ↓
     │         ← WebSocket Broadcast (tool_executed)
     ↓
AI Response → TTS → User
```

## Testing

```bash
cd backend
npm install
npm run build  # Success!
```

## Next Steps
- Phase 5: Frontend V3 update (tool_executed 이벤트 처리)
- Phase 6: V2 → V3 naming (코드 내용 변경 없이 파일/클래스명만 변경)
