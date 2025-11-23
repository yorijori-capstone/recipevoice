# 요리조리(Yorijori) V3 시스템 전체 흐름

## 1. 초기 설정 (1회 실행)

```
npm run import
    ↓
Import Script: Raw Recipe JSON 로드
    ↓
recipes 테이블에 raw_data (JSONB) 저장
    ↓
npm run clean:all
    ↓
CleanedRecipeService: raw_data에서 레시피 정보 추출
    ↓
PlanningService: gpt-5-nano로 각 레시피 Planning 실행
    - meta (title, description, servings, time, difficulty)
    - ingredients (main, sub)
    - tools
    - process (단계별 상세 정보)
    ↓
CleanedRecipeService: PostgreSQL 저장
    - cleaned_recipes 테이블 (planning_result JSONB)
    - cleaned_steps 테이블 (단계별 스크립트)
```

## 2. 레시피 검색 및 선택

### 2-1. 레시피 검색 (RAG 또는 Keyword)
```
Frontend: DashboardV3.tsx
    ↓
사용자 검색어 입력: "김치"
    ↓
API: GET /api/recipes/search/rag?q=김치&top_k=10
    ↓
Backend: RAG 검색 또는 Keyword 검색
    - RAG: FAISS 인덱스에서 의미 기반 검색
    - Keyword: cleaned_recipes 테이블 ILIKE 검색
    ↓
Frontend: RecipeCard 리스트 렌더링
```

### 2-2. AI 레시피 생성 (검색 실패 시)
```
Frontend: "AI로 새 레시피 생성하기" 버튼 클릭
    ↓
API: POST /api/recipes/generate { prompt: "스테이크" }
    ↓
Backend NanoService:
    1. gpt-5-nano로 레시피 생성
    2. recipes 테이블 저장 (recipe_id: recipe_gen_123)
    3. raw_data (JSONB)에 전체 레시피 저장
    ↓
Backend CleanedRecipeService:
    4. PlanningService 자동 실행 (gpt-5-nano)
    5. cleaned_recipes (planning_result JSONB), cleaned_steps 저장
    ↓
Frontend: 생성 완료 → DashboardV2에서 즉시 검색 가능
```

## 3. 요리 세션 시작 (0.1초 ⚡)

```
Frontend: 레시피 카드 "요리 시작" 버튼 클릭
    ↓
Navigate: /cooking/:recipeId
    ↓
CookingMode.tsx 마운트
    ↓
API: POST /api/cooking/v2/start { recipeId: "6838792" }
    ↓
Backend CookingAgentV2.startCookingSession():
    1. cleaned_recipes 테이블에서 Planning 결과 로드 (즉시)
    2. cooking_sessions 테이블에 세션 생성
    3. Node.js Map 메모리에 세션 객체 저장
    ↓
Response: {
  sessionId: "session_123",
  title: "배추 김치",
  plannedSteps: [15개 단계],
  openingRemark: "안녕하세요...",
  currentStepIndex: 0
}
    ↓
Frontend: CookingMode UI 렌더링
    - ProgressBar: 0/15
    - StepDisplay: 1단계 스크립트
    - VoiceInteraction: WebSocket 연결 준비
```

## 4. WebSocket & Realtime API 연결

```
Frontend: useWebSocket.connect(sessionId)
    ↓
WebSocket: ws://localhost:3001
    ↓
Frontend: { type: 'init_session', sessionId }
    ↓
Backend ServerV2.ts:
    1. RealtimeServiceV2.setActiveSession(sessionId)
    2. OpenAI Realtime API 연결
    ↓
RealtimeServiceV2:
    1. CookingAgent에서 세션 가져오기 (Node.js Map)
    2. System Prompt 생성:
       - 레시피 제목
       - 현재 단계 (plannedSteps[0])
       - script, retry_script, pause_hint
    3. OpenAI Realtime API에 전송
    ↓
Frontend: 연결 완료 → 음성 상호작용 준비
```

## 5. 음성 명령 실행 (MCP Protocol 자동 처리)

```
사용자: "다음 단계로 가줘" (음성 입력)
    ↓
Frontend: useAudioRecorder → PCM16 음성 데이터
    ↓
WebSocket: { type: 'audio_chunk', audio: base64 }
    ↓
Backend RealtimeServiceV3 → OpenAI Realtime API
    ↓
OpenAI GPT-4o-realtime:
    1. 음성 → 텍스트 변환
    2. Transcript: "다음 단계로 가줘"
    3. Native Tool Calling: navigate_next_step() 자동 호출
    ↓
Backend: 'user_transcription' 이벤트 emit
    ↓
RealtimeServiceV3 → MCP Tool Execution:
    1. navigate_next_step(sessionId) 실행
    ↓
CookingAgentV3.nextStep():
    1. session.currentStepIndex++
    2. session_states 테이블에 로그 저장
    3. Node.js Map 세션 업데이트
    4. 새 단계 반환: process[1] (planning_result에서)
    ↓
RealtimeServiceV3:
    1. System Prompt 재생성 (새 단계 정보)
    2. OpenAI Realtime API 업데이트
    3. 'tool_executed' 이벤트 emit
    ↓
Backend ServerV2 → Frontend WebSocket:
    { type: 'session_state_updated', currentStepIndex: 1 }
    ↓
Frontend:
    1. useWebSocket.onSessionStateUpdated
    2. VoiceInteraction.onSessionStateUpdated
    3. CookingMode UI 자동 갱신
       - ProgressBar: 1/15 → 2/15
       - StepDisplay: 2단계 스크립트
    ↓
OpenAI GPT-4o-realtime: TTS 음성 응답
    "2단계입니다. 고춧가루 2컵을..."
    ↓
Frontend: 스피커로 음성 출력
```

## 6. 데이터 흐름 요약

### 레시피 데이터 경로:
```
[Raw Recipe DB]
    ↓ (Planning 1회 실행)
[cleaned_recipes + cleaned_steps] ← PostgreSQL 영구 저장
    ↓ (세션 시작 시)
[CookingAgentV2 Map] ← Node.js RAM (빠른 조회)
    ↓ (WebSocket 연결 시)
[RealtimeServiceV2 System Prompt] ← OpenAI API 전송
    ↓ (음성 대화)
[GPT-4o-realtime] ← 스크립트 기반 음성 안내
```

### API 호출 순서:
```
1. POST /api/recipes/generate          (AI 레시피 생성)
2. GET  /api/recipes/search/cleaned    (레시피 검색)
3. POST /api/cooking/v2/start          (세션 시작)
4. WebSocket init_session              (Realtime 연결)
5. WebSocket audio_chunk               (음성 입력)
6. POST /api/cooking/v2/session/:id/next  (수동 다음 단계)
7. DELETE /api/recipes/:recipeId       (AI 레시피 삭제)
```

### DB 테이블 역할:
```
recipes              → 원본 레시피 (102개 + AI 생성)
ingredients          → 재료 목록
steps                → 원본 조리 단계
cleaned_recipes      → Planning 결과 (opening/closing remark)
cleaned_steps        → 단계별 스크립트 (script, retry_script, pause_hint)
cooking_sessions     → 세션 메타데이터
session_states       → 세션 상태 히스토리 (단계 이동 로그)
```

## 7. 핵심 성능 최적화

### 0.1초 세션 시작:
- ❌ 실시간 Planning (50초)
- ✅ 사전 Planning 결과 조회 (0.1초)
- cleaned_recipes 테이블에서 즉시 로드

### 음성 명령 자동 처리:
- ❌ if/else 패턴 매칭
- ✅ LangChain + GPT-3.5 Intent Detection
- 자연어 이해 및 자동 Tool 실행

### 실시간 UI 동기화:
- ❌ Frontend 폴링
- ✅ WebSocket 이벤트 push
- Backend 상태 변경 시 자동 broadcast

## 8. Frontend 컴포넌트 흐름

```
App.tsx
    ↓
DashboardV2.tsx (레시피 검색/선택)
    ↓ 요리 시작 클릭
CookingMode.tsx (메인 페이지)
    ├─ useCookingSessionV2 (세션 관리)
    ├─ ProgressBar (진행률 표시)
    ├─ StepDisplay (현재 단계 스크립트)
    ├─ TimerDisplay (타이머)
    ├─ ControlButtons (다음/이전 버튼)
    └─ VoiceInteraction (음성 UI)
        ├─ useWebSocket (WebSocket 연결)
        ├─ useAudioRecorder (음성 녹음)
        └─ AudioPlayer (TTS 재생)
```

## 9. Backend 서비스 구조

```
ServerV2.ts (Express + WebSocket)
    ├─ CookingServiceV2 (통합 서비스)
    │   ├─ CookingAgentV2 (세션 관리)
    │   ├─ LangChainAgent (Intent Detection)
    │   └─ RealtimeServiceV2 (OpenAI Realtime API)
    │
    ├─ RecipeService (원본 레시피)
    ├─ CleanedRecipeService (Planning 결과)
    ├─ NanoService (AI 레시피 생성)
    ├─ SessionService (세션 DB 관리)
    └─ PlanningService (GPT-4o Planning)
```

## 10. 에러 처리 및 복구

### 페이지 새로고침:
```
localStorage에 sessionId + recipeId 저장
    ↓
CookingMode 마운트 시 recipeId 비교
    ↓
같으면: GET /api/cooking/v2/session/:id (복구)
다르면: POST /api/cooking/v2/start (새 세션)
```

### WebSocket 연결 끊김:
```
useWebSocket 자동 재연결
    ↓
init_session 재전송
    ↓
RealtimeServiceV2 재초기화
```

### AI 레시피 삭제:
```
RecipeCard 🗑️ 버튼
    ↓
DELETE /api/recipes/:recipeId
    ↓
5개 테이블 CASCADE 삭제
    ↓
DashboardV2 목록 새로고침
```
