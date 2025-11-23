# V1 레거시 파일 정리 계획

## 삭제할 V1 파일 목록

### Backend 파일:

#### 서버:
- ❌ `backend/src/server.ts` → V1 서버 (serverV2.ts로 대체됨)

#### Agents:
- ❌ `backend/src/agents/cookingAgent.ts` → V1 에이전트 (cookingAgentV2.ts로 대체됨)
- ❌ `backend/src/agents/mcpClient.ts` → 사용하지 않음

#### Services:
- ❌ `backend/src/services/cookingService.ts` → V1 서비스 (cookingServiceV2.ts로 대체됨)
- ❌ `backend/src/services/realtimeService.ts` → V1 Realtime (realtimeServiceV2.ts로 대체됨)
- ❌ `backend/src/services/intentClassifier.ts` → LangChain으로 대체됨
- ❌ `backend/src/services/langchainService.ts` → langchainAgent.ts로 대체됨

#### Routes:
- ❌ `backend/src/routes/cooking.ts` → V1 API (cookingV2.ts로 대체됨)

#### MCP (사용하지 않음):
- ❌ `backend/src/mcp/` 전체 디렉토리

### 유지할 V2 파일 목록:

#### 서버:
- ✅ `backend/src/serverV2.ts`

#### Agents:
- ✅ `backend/src/agents/cookingAgentV2.ts`
- ✅ `backend/src/agents/langchainAgent.ts`

#### Services:
- ✅ `backend/src/services/cookingServiceV2.ts`
- ✅ `backend/src/services/realtimeServiceV2.ts`
- ✅ `backend/src/services/cleanedRecipeService.ts`
- ✅ `backend/src/services/planningService.ts`
- ✅ `backend/src/services/recipeService.ts`
- ✅ `backend/src/services/nanoService.ts`
- ✅ `backend/src/services/sessionService.ts`

#### Routes:
- ✅ `backend/src/routes/cookingV2.ts`
- ✅ `backend/src/routes/recipes.ts`

#### DB:
- ✅ `backend/src/db/pool.ts`

#### Types:
- ✅ `backend/src/types/index.ts`

## package.json 스크립트 정리:

### 삭제할 스크립트:
- ❌ `dev` (server.ts 실행)
- ❌ `start` (V1 서버)

### 변경할 스크립트:
- `dev` → `dev:v2`로 변경
- `start` → V2 서버로 변경

## 정리 후 파일 구조:

```
backend/
├── src/
│   ├── agents/
│   │   ├── cookingAgentV2.ts
│   │   └── langchainAgent.ts
│   ├── services/
│   │   ├── cookingServiceV2.ts
│   │   ├── realtimeServiceV2.ts
│   │   ├── cleanedRecipeService.ts
│   │   ├── planningService.ts
│   │   ├── recipeService.ts
│   │   ├── nanoService.ts
│   │   └── sessionService.ts
│   ├── routes/
│   │   ├── cookingV2.ts
│   │   └── recipes.ts
│   ├── db/
│   │   └── pool.ts
│   ├── types/
│   │   └── index.ts
│   └── serverV2.ts
└── package.json
```

## 정리 예상 효과:

- 📦 파일 개수: 22개 → 14개 (36% 감소)
- 🗂️ 디렉토리: 7개 → 6개
- 📝 코드 라인: 약 3000 라인 감소
- 🧹 복잡도 감소: V1/V2 혼란 제거
