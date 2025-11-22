# Yorijori Cooking Assistant - V3 Architecture

**Version**: 3.0
**Status**: Production Ready
**Last Updated**: 2025-11-22

---

## 🏗️ System Architecture Diagram

```
[Raw Recipe DB (102개)]
        |
        | (1회 실행: npm run clean:all)
        v
[RecipeService + Planning Service (GPT-4o)]
        |
        | Planning 결과 저장
        v
[Cleaned Recipe DB] ────────────────────────────────┐
        |                                            |
        | (실시간 검색)                               | (AI 생성)
        v                                            v
[DashboardV2 UI] ──────> 검색 실패 시 ──────> [NanoService]
        |                                      (GPT-4o)
        |                                            |
        |                                            | 레시피 생성 +
        |                                            | Planning 자동 실행
        |                                            v
        +<───────────────────────────────── [Cleaned Recipe DB 저장]
        |
        | 사용자 레시피 선택
        v
[CookingAgentV3 / CookingServiceV3]
        |
        | Session 생성 (0.1초 ⚡)
        v
[SessionService] ────> [Session DB (cooking_sessions)]
        |
        | WebSocket V3 연결
        v
[ServerV3] <───> [RealtimeServiceV3] <───> [Frontend CookingMode]
        |              |
        |              +--> [OpenAI Realtime API - gpt-realtime]
        |              |    (음성 입/출력 + Native Tool Calling)
        |              |
        |              +--> [MCP Tool Execution] ⚡ NEW!
        |                   |
        |                   +--> navigate_next_step
        |                   +--> navigate_previous_step
        |                   +--> navigate_to_step
        |                   +--> start_timer
        |                   +--> stop_timer
        |                   +--> get_current_step
        |                   +--> get_recipe_info
        |                        |
        |                        v
        |                   CookingAgentV3 실행
        |                        |
        |                        v
        |                   SessionService 업데이트
        |                        |
        |                        v
        +──────────────────> [Session DB 저장]
                                 |
                                 +--> session_states (로그)

Events Flow:
ServerV3 ──> 'tool_executed'         ──> Frontend (Tool 실행 결과)
         ──> 'step_changed'          ──> Frontend (자동 UI 업데이트)
         ──> 'session_state_updated' ──> Frontend (상태 동기화)
```

**주요 특징 (V3)**:

- ⚡ **Pre-Planning**: 102개 레시피 사전 처리 (1회만)
- 🚀 **즉시 시작**: 0.1초 세션 시작 (50-100배 빠름)
- 🤖 **AI 생성**: GPT-3.5로 실시간 레시피 생성
- 🔧 **Native Tool Calling**: LangChain 제거, OpenAI Realtime API 직접 통합
- 💾 **세션 복구**: PostgreSQL + localStorage
- 🔄 **Real-time Sync**: WebSocket V3 이벤트 broadcasting
- 🎯 **MCP Protocol**: 7개 도구로 요리 흐름 제어

---

## 🎯 V2 → V3 변경사항

### 제거된 것 (V2)

- ❌ **LangChain Agent** - Intent Detection 레이어 제거
- ❌ **GPT-3.5 Intent Classification** - 별도 API 호출 제거
- ❌ **Tool Routing Layer** - 중간 라우팅 제거
- ❌ **langchain_response 이벤트** - 불필요

### 추가된 것 (V3)

- ✅ **OpenAI Realtime Native Tool Calling** - AI가 직접 도구 호출
- ✅ **MCP (Model Context Protocol)** - 표준화된 도구 인터페이스
- ✅ **tool_executed 이벤트** - 도구 실행 결과 전달
- ✅ **gpt-realtime 모델** - 최신 Realtime API 모델
- ✅ **Timer State Sync** - 타이머 상태 AI 컨텍스트 동기화
- ✅ **Greeting Flow** - 3단계 인사 흐름 (인사 → 소개 → 시작)
- ✅ **Ingredients Info** - 재료 목록 AI 컨텍스트 포함

---

## 🎯 Overall Flow (V3)

```
사용자
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Pre-Planning (오프라인, 1회만 실행)                      │
└─────────────────────────────────────────────────────────────────┘

Batch Script: npm run clean:all
  ↓
CleanedRecipeService.cleanAllRecipes()
  ↓
For each raw recipe:
  ↓
  Planning Service (GPT-4o)
    - RecipeInput → PlanningOutput 변환
    - 각 단계별 script, retry_script, timer 정보 생성
  ↓
  cleaned_recipes 테이블 저장
  cleaned_steps 테이블 저장
  ↓
102개 레시피 사전 처리 완료

┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Session Start (실시간, 0.1초)                           │
└─────────────────────────────────────────────────────────────────┘

DashboardV2: 레시피 검색 or AI 생성
  ↓
RecipeDetail 페이지: "요리 시작" 버튼 클릭
  ↓
Frontend: POST /api/cooking/v3/start { recipeId }
  ↓
Backend: CookingAgentV3.startCookingSession()
  ↓
CleanedRecipeService.getCleanedRecipe(recipeId)
  - Planning 결과 즉시 로드 (0.1초) ✨
  - 재료 목록 함께 로드 🆕
  ↓
SessionService.createSession()
  - cooking_sessions 테이블 생성
  - session_states 로그 시작
  ↓
Backend → Frontend: Session 데이터
  {
    sessionId: "session_xxx",
    recipeId: "recipe_gen_123",
    cleanedRecipeId: 5,
    title: "소고기 미역국",
    openingRemark: "안녕하세요! 소고기 미역국을...",
    closingRemark: "요리가 완성되었습니다!",
    totalSteps: 5,
    currentStepIndex: 0,
    viewingStepIndex: 0,
    status: "active",
    ingredients: [...],  // 🆕 재료 목록
    plannedSteps: [...]
  }
  ↓
localStorage.setItem('yorijori_current_session_id', sessionId)

┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Voice Interaction (OpenAI Realtime + MCP Tools)        │
└─────────────────────────────────────────────────────────────────┘

Frontend: CookingMode 페이지 렌더링
  ├─ Opening Remark (자동 표시)
  ├─ ProgressBar (currentStepIndex 기준)
  ├─ StepDisplay (viewingStepIndex 기준)
  ├─ TimerDisplay (타이머 + 알림음)
  ├─ ControlButtons (UI 탐색용)
  └─ VoiceInteraction (음성 대화 ON/OFF)
  ↓
WebSocket V3 연결: Frontend ↔ ServerV3
  ↓
Backend: RealtimeServiceV3.connect()
  ├─ OpenAI Realtime API (gpt-realtime) 🆕
  └─ MCP Tools Registration (7개 도구)
  ↓
🎯 첫 대화 흐름 (3단계):

  STEP A - 인사 대기:
  사용자: "누구세요?"
  AI: "안녕하세요! 저는 요리 도우미입니다. '안녕'이라고 인사해주시면 오늘의 요리를 소개해드릴게요!"

  STEP B - 인사 받음 → 레시피 소개:
  사용자: "안녕"
  AI: "안녕하세요! 오늘은 소고기 미역국을 만들어 볼게요!
       필요한 재료는 소고기 100g, 미역 20g... 입니다.
       재료가 준비되셨으면 '시작'이라고 말씀해주세요!"

  STEP C - 시작 확인 → 요리 시작:
  사용자: "시작"
  AI: "좋습니다! 첫 번째 단계입니다. 미역을 물에 불려주세요..."
  ↓
사용자 음성 입력: "다음 단계로 가줘"
  ↓
Backend: OpenAI Realtime API가 직접 Tool 호출 결정 🆕
  - AI가 자연어 이해 → Tool 선택 → 파라미터 추출
  - function_call: { name: "navigate_next_step", arguments: {} }
  ↓
Backend: RealtimeServiceV3.handleFunctionCall()
  - MCP Tool 실행: navigate_next_step
  - CookingAgentV3.nextStep(sessionId)
  - SessionService.updateSession()
  - Database 업데이트
  ↓
Backend → Frontend: Events
  - 'tool_executed': { tool: "navigate_next_step", result: {...} }
  - 'step_changed': { sessionId, step, stepIndex }
  - 'session_state_updated': { currentStepIndex, viewingStepIndex }
  ↓
Frontend: useWebSocket 이벤트 수신
  - VoiceInteraction.onToolExecuted()
  - CookingMode.handleStepAutoChanged()
  - UI 자동 업데이트 ✨
  ↓
Backend: OpenAI Realtime API 응답 생성
  - Tool 결과를 참조한 자연어 응답
  - 음성 출력: "좋습니다! 다음 단계입니다..."
  ↓
Frontend: 음성 재생 + Transcript 표시

┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Timer State Sync (실시간 타이머 동기화) 🆕              │
└─────────────────────────────────────────────────────────────────┘

타이머 시작:
  Frontend: TimerDisplay.startTimer()
  ↓
  WebSocket: timer_state_update { isRunning: true, remainingTime: 600 }
  ↓
  Backend: RealtimeServiceV3.updateTimerState()
  ↓
  AI 컨텍스트 업데이트: "⏱️ TIMER RUNNING: 600초 남음"

타이머 완료:
  Frontend: TimerDisplay → onComplete()
  ↓
  WebSocket: timer_state_update { isCompleted: true }
  ↓
  Backend: AI 컨텍스트: "⏱️ TIMER COMPLETED!"
  ↓
  Frontend: Victory Fanfare 알림음 🎵
  ↓
  AI: "타이머가 종료되었습니다!"
```

---

## 📦 Components Structure (V3)

### Backend

```
backend/src/
├── agents/
│   ├── cookingAgent.ts              # V1 (Legacy)
│   ├── cookingAgentV2.ts            # V2 (Legacy)
│   └── cookingAgentV3.ts            # ✨ V3: MCP Tool 통합
├── services/
│   ├── recipeService.ts             # Raw recipes (102개)
│   ├── cleanedRecipeService.ts      # ✨ V3: Ingredients 포함
│   ├── nanoService.ts               # AI recipe generation (GPT-3.5)
│   ├── sessionService.ts            # Session persistence (PostgreSQL)
│   ├── realtimeService.ts           # V1 (Legacy)
│   ├── realtimeServiceV2.ts         # V2 (Legacy)
│   ├── realtimeServiceV3.ts         # ✨ V3: Native Tool Calling
│   ├── cookingService.ts            # V1 (Legacy)
│   ├── cookingServiceV2.ts          # V2 (Legacy)
│   └── cookingServiceV3.ts          # ✨ V3: gpt-realtime 모델
├── routes/
│   ├── recipes.ts                   # 검색 API
│   ├── cooking.ts                   # V1 (Legacy)
│   ├── cookingV2.ts                 # V2 (Legacy)
│   └── cookingV3.ts                 # ✨ V3: 엔드포인트
├── mcp/
│   ├── tools.ts                     # V2 Tools (Legacy)
│   └── mcpClientManager.ts          # ✨ V3: MCP Protocol 클라이언트
├── server.ts                        # V1 (Legacy)
├── serverV2.ts                      # V2 (Legacy)
└── serverV3.ts                      # ✨ V3: WebSocket + Timer Sync
```

### Frontend

```
frontend2/src/
├── pages/
│   ├── Dashboard.tsx                # V1 (Legacy, /v1 경로)
│   ├── DashboardV2.tsx              # V2/V3: 검색 + AI 생성
│   ├── RecipeDetail.tsx             # 레시피 상세
│   └── CookingMode.tsx              # ✨ V3: Timer State Sync
├── hooks/
│   ├── useCookingSession.ts         # V1 (Legacy)
│   ├── useCookingSessionV2.ts       # V2/V3: Session recovery
│   ├── useWebSocket.ts              # ✨ V3: tool_executed, sendTimerState
│   └── useAudioRecorder.ts          # 음성 녹음
├── components/
│   ├── RecipeGenerateModal.tsx      # AI 레시피 생성
│   └── CookingUI/
│       ├── ProgressBar.tsx          # 전체 진행률
│       ├── StepDisplay.tsx          # 현재 단계 표시
│       ├── TimerDisplay.tsx         # ✨ V3: Victory Fanfare 알림음
│       ├── ControlButtons.tsx       # 제어 버튼
│       └── VoiceInteraction.tsx     # ✨ V3: sendTimerState, 인사 안내
└── App.tsx                          # DashboardV2 기본 경로
```

---

## 🔄 V2 vs V3 Architecture

### V2 Architecture (LangChain)

```
User Voice Input
  ↓
OpenAI Realtime API (Transcription)
  ↓
LangChainAgent.detectIntent() ❌ 추가 API 호출
  - GPT-3.5-turbo: Intent Classification
  - 지연 시간 추가
  ↓
LangChainAgent.executeIntent()
  - Tool routing (수동)
  ↓
CookingAgentV2 실행
  ↓
OpenAI Realtime API (Response)
  ↓
Audio Output
```

**문제점**:

- ❌ 추가 API 호출 (GPT-3.5 Intent Detection)
- ❌ 복잡한 Tool Routing 레이어
- ❌ 지연 시간 증가
- ❌ 유지보수 복잡성

### V3 Architecture (Native Tool Calling)

```
User Voice Input
  ↓
OpenAI Realtime API (gpt-realtime)
  - Transcription
  - Intent Understanding  ✅ 통합!
  - Tool Selection        ✅ 통합!
  - Parameter Extraction  ✅ 통합!
  ↓
function_call: { name: "navigate_next_step", arguments: {} }
  ↓
MCP Tool Execution
  ↓
CookingAgentV3 실행
  ↓
Tool Result → AI Context
  ↓
OpenAI Realtime API (Response)
  ↓
Audio Output
```

**개선사항**:

- ✅ 단일 API 호출 (gpt-realtime이 모든 것 처리)
- ✅ 간소화된 아키텍처
- ✅ 빠른 응답 시간
- ✅ 유지보수 용이

---

## 🔧 MCP Tools (V3)

### 사용 가능한 도구

| Tool                     | Description           | Parameters                  |
| ------------------------ | --------------------- | --------------------------- |
| `navigate_next_step`     | 다음 단계로 이동      | -                           |
| `navigate_previous_step` | 이전 단계로 이동      | -                           |
| `navigate_to_step`       | 특정 단계로 이동      | `step_number: number`       |
| `start_timer`            | 타이머 시작           | `duration_seconds?: number` |
| `stop_timer`             | 타이머 정지           | -                           |
| `get_current_step`       | 현재 단계 정보 조회   | -                           |
| `get_recipe_info`        | 레시피 전체 정보 조회 | -                           |

### Tool 호출 예시

```typescript
// AI가 "다음 단계로 가줘"를 듣고 자동으로 결정
{
  type: "response.function_call_arguments.done",
  name: "navigate_next_step",
  arguments: "{}"
}

// Backend에서 처리
const result = await mcpClient.executeTool('navigate_next_step', {
  session_id: currentSessionId
});

// Frontend로 이벤트 전송
ws.send(JSON.stringify({
  type: 'tool_executed',
  tool: 'navigate_next_step',
  result: result
}));
```

---

## 📊 Database Schema (V3)

### cleaned_recipes

```sql
CREATE TABLE cleaned_recipes (
  id                SERIAL PRIMARY KEY,
  recipe_id         VARCHAR(50) REFERENCES recipes(recipe_id),
  planning_result   JSONB,
  title             VARCHAR(255),
  opening_remark    TEXT,
  closing_remark    TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### ingredients (재료 정보 - V3에서 활용)

```sql
CREATE TABLE ingredients (
  id              SERIAL PRIMARY KEY,
  recipe_id       VARCHAR(50) REFERENCES recipes(recipe_id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  quantity        VARCHAR(50),
  display_order   INTEGER
);
```

### cleaned_steps

```sql
CREATE TABLE cleaned_steps (
  id                  SERIAL PRIMARY KEY,
  cleaned_recipe_id   INTEGER REFERENCES cleaned_recipes(id),
  step_order          INTEGER,
  script              TEXT,
  retry_script        TEXT,
  fallback_script     TEXT,
  pause_hint          TEXT,
  estimated_time_sec  INTEGER,
  timer_required      BOOLEAN,
  timer_message       TEXT
);
```

### cooking_sessions

```sql
CREATE TABLE cooking_sessions (
  session_id          VARCHAR(100) PRIMARY KEY,
  user_id             VARCHAR(100),
  cleaned_recipe_id   INTEGER REFERENCES cleaned_recipes(id),
  current_step_index  INTEGER DEFAULT 0,
  viewing_step_index  INTEGER DEFAULT 0,
  status              VARCHAR(20) DEFAULT 'active',
  total_steps         INTEGER,
  started_at          TIMESTAMP DEFAULT NOW(),
  ended_at            TIMESTAMP,
  last_activity_at    TIMESTAMP DEFAULT NOW()
);
```

### session_states

```sql
CREATE TABLE session_states (
  id           SERIAL PRIMARY KEY,
  session_id   VARCHAR(100) REFERENCES cooking_sessions(session_id),
  state_type   VARCHAR(50),
  state_data   JSONB,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 API Endpoints (V3)

### Cooking Session V3

| Method | Endpoint                                      | Description                  |
| ------ | --------------------------------------------- | ---------------------------- |
| POST   | `/api/cooking/v3/start`                       | 요리 세션 시작 (즉시, 0.1초) |
| GET    | `/api/cooking/v3/session/:sessionId`          | 세션 복구                    |
| POST   | `/api/cooking/v3/session/:sessionId/next`     | 다음 단계                    |
| POST   | `/api/cooking/v3/session/:sessionId/previous` | 이전 단계                    |
| POST   | `/api/cooking/v3/session/:sessionId/end`      | 세션 종료                    |
| GET    | `/api/cooking/v3/session/:sessionId/history`  | 상태 변경 로그               |
| GET    | `/api/cooking/v3/health`                      | Health check                 |

### WebSocket V3 Events

| Event                        | Direction          | Description           |
| ---------------------------- | ------------------ | --------------------- |
| `init_session`               | Frontend → Backend | sessionId로 초기화    |
| `audio`                      | Frontend → Backend | 음성 데이터 전송      |
| `start_streaming`            | Frontend → Backend | 음성 스트리밍 시작    |
| `stop_streaming`             | Frontend → Backend | 음성 스트리밍 종료    |
| `set_vad_mode`               | Frontend → Backend | VAD 모드 변경         |
| `send_text`                  | Frontend → Backend | 텍스트 메시지 전송    |
| `timer_state_update`         | Frontend → Backend | 🆕 타이머 상태 동기화 |
| `user_transcription`         | Backend → Frontend | 사용자 음성 텍스트    |
| `assistant_transcript_delta` | Backend → Frontend | AI 응답 텍스트        |
| `audio_delta`                | Backend → Frontend | AI 음성 데이터        |
| `tool_executed`              | Backend → Frontend | 🆕 MCP Tool 실행 결과 |
| `step_changed`               | Backend → Frontend | Step 변경 이벤트      |
| `session_state_updated`      | Backend → Frontend | 세션 상태 동기화      |

---

## 🎯 Key Features (V3)

### 1. Native Tool Calling

- LangChain 제거, OpenAI Realtime API 직접 통합
- AI가 사용자 의도 파악 → 도구 선택 → 실행 (원스톱)
- 빠른 응답, 간소화된 코드

### 2. MCP Protocol

- 7개 표준화된 도구 인터페이스
- navigate*\*, timer*\_, get\_\_ 도구
- 확장 가능한 구조

### 3. Timer State Sync

- Frontend → Backend 실시간 타이머 상태 전송
- AI가 타이머 진행/완료 상태 인식
- 컨텍스트 기반 응답 생성

### 4. 3단계 인사 흐름

- STEP A: 인사 대기 (자기소개만)
- STEP B: 인사 후 레시피/재료 소개
- STEP C: "시작" 확인 후 요리 시작

### 5. Victory Fanfare

- 타이머 완료 시 드라마틱한 알림음
- Web Audio API로 아르페지오 + 코드 재생

### 6. gpt-realtime 모델

- 최신 OpenAI Realtime API 모델
- 2024-10-01 버전에서 업그레이드
- 향상된 음성 인식 및 응답

---

## 📈 Performance Comparison

| Metric                    | V1          | V2                  | V3                    |
| ------------------------- | ----------- | ------------------- | --------------------- |
| **Session Start**         | 5-10초      | 0.1초               | 0.1초                 |
| **Intent Detection**      | 수동 (if문) | LangChain (GPT-3.5) | Native (gpt-realtime) |
| **API Calls per Command** | 1           | 2+                  | 1                     |
| **Tool Execution**        | 수동        | LangChain Router    | MCP Direct            |
| **Response Latency**      | ~1s         | ~1.5s               | ~0.8s                 |
| **Code Complexity**       | Medium      | High                | Low                   |
| **Timer Awareness**       | No          | No                  | Yes                   |
| **Greeting Flow**         | No          | No                  | Yes                   |

---

## 🎨 UI Components (V3)

### CookingMode Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  소고기 미역국              [요리 종료]                           │
│  음성 가이드 요리 모드                                            │
├─────────────────────────────────────────────────────────────────┤
│  🗨️ AI 요리 가이드                                        [X]   │
│  안녕하세요! 소고기 미역국 만들기를 시작하겠습니다.               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔥 요리 중                          2 / 5 단계                  │
│  ████████░░░░░░░░░░░░░░░░░░░░ 40%                              │
│  ● ● ○ ○ ○                                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬───────────────────────────────┐
│  📝 현재 단계 (2/5)              │  🎮 제어                       │
│                                 │                               │
│  미역 이십 그램을 물에           │  [이전 단계]                   │
│  불려주세요. 약 십 분 정도       │  [다음 단계]                   │
│  불리시면 됩니다.                │                               │
│                                 │  [Planning 결과 보기]          │
│  ⏱️ 타이머: 09:42 / 10:00       │  [요리 종료]                   │
│  ████████████░ 97%              │                               │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│  🎙️ 음성 대화                              ✅ 연결됨             │
│                                                                 │
│  [🎤 음성 대화 ON]  ← 🆕 심플한 ON/OFF 토글                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎤 말씀하시면 자동으로 인식됩니다                         │   │
│  │ 👋 "안녕"이라고 인사해서 요리를 시작하세요!               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  👤 사용자: 안녕                                                 │
│  🤖 AI: 안녕하세요! 오늘은 소고기 미역국을 만들어 볼게요!        │
│        필요한 재료는 소고기 100g, 미역 20g... 입니다.           │
│        재료가 준비되셨으면 '시작'이라고 말씀해주세요!            │
│                                                                 │
│  💡 현재 단계: 2 / 5                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🎉 요리 완료!                                                   │
│                                                                 │
│  🗨️ 맛있는 소고기 미역국이 완성되었습니다!                       │
│     맛있게 드세요!                                               │
│                                                                 │
│  [홈으로]  [레시피 다시 보기]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend V3**:

```bash
cd backend
npm run dev:v3
# → http://localhost:3001
```

**Terminal 2 - Frontend**:

```bash
cd frontend2
npm run dev
# → http://localhost:5173
```

### Production Build

```bash
# Backend
cd backend
npm run build
npm run start:v3

# Frontend
cd frontend2
npm run build
npm run preview
```

### Health Check

```
Backend: http://localhost:3001/health
V3 API: http://localhost:3001/api/cooking/v3/health
Frontend: http://localhost:5173
```

---

## 🧪 Testing Guide

### 1. 인사 흐름 테스트 (V3 신규)

1. 요리 시작 → 음성 대화 ON
2. "누구세요?" → 자기소개만 (레시피 언급 X)
3. "안녕" → 레시피 + 재료 소개 + "시작" 요청
4. "시작" → 첫 번째 단계 안내

### 2. Tool Calling 테스트

1. 요리 진행 중 "다음 단계로 가줘"
2. 콘솔에서 `tool_executed` 이벤트 확인
3. UI 자동 업데이트 확인

### 3. 타이머 동기화 테스트

1. 타이머가 있는 단계로 이동
2. "타이머 시작" → 타이머 시작
3. 타이머 진행 중 "타이머 얼마나 남았어?"
4. AI가 남은 시간 인식하고 응답
5. 타이머 완료 → Victory Fanfare 알림음

### 4. Session Recovery 테스트

1. 요리 시작 → Step 3으로 이동
2. F5 (새로고침)
3. Step 3 복원 확인

---

## 📝 Model Information

### OpenAI Realtime API Model

| 속성         | 값                                                |
| ------------ | ------------------------------------------------- |
| Model ID     | `gpt-realtime`                                    |
| 이전 모델    | `gpt-4o-realtime-preview-2024-10-01` (deprecated) |
| Voice        | `alloy`                                           |
| VAD Mode     | `server_vad`                                      |
| Tool Calling | Native (MCP)                                      |

---

## 🎊 V3 Architecture Complete!

**Recipe Voice Assistant V3 아키텍처 마이그레이션 완료!**

**V3 주요 성과**:

- 🔧 **LangChain 제거** - 심플한 아키텍처
- ⚡ **Native Tool Calling** - OpenAI Realtime API 직접 통합
- 🎯 **MCP Protocol** - 7개 표준화된 도구
- ⏱️ **Timer State Sync** - AI가 타이머 상태 인식
- 👋 **Greeting Flow** - 3단계 인사 흐름
- 🎵 **Victory Fanfare** - 드라마틱한 타이머 알림음
- 🆕 **gpt-realtime** - 최신 모델 적용

**실제 사용 가능한 상태입니다!** 🎉
