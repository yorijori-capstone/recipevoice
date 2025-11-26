# RecipeVoice 아키텍처 다이어그램

## 시스템 아키텍처

```mermaid
graph TB
    %% User Layer
    User[👤 User]
    VoiceTouch[🎤 Voice / 👆 Touch]
    Frontend[⚛️ Frontend<br/>React]
    
    %% Backend Layer
    Backend[🚀 Backend<br/>Express]
    
    %% Backend Services
    RealtimeService[🔊 RealtimeServiceV3<br/>Voice Interaction]
    RecipeCleaner[🧹 RecipeCleaner<br/>Recipe Cleaning/Planning]
    RecipeCreator[🤖 RecipeCreator<br/>Recipe Generation]
    SessionService[📋 SessionService<br/>Session Management]
    CookingAgent[🎯 CookingAgentV3<br/>Orchestration]
    
    %% Data Layer
    PostgreSQL[(🗄️ PostgreSQL<br/>recipevoice DB)]
    RAGServer[🔍 RAG Server<br/>FAISS Search]
    
    %% External APIs
    OpenAIRealtime[🌐 OpenAI Realtime API<br/>gpt-realtime]
    OpenAINano[🌐 OpenAI API<br/>gpt-5-nano]
    MCPTools[🔧 MCP Tools<br/>Native Tool Calling]
    
    %% User Flow
    User --> VoiceTouch
    VoiceTouch --> Frontend
    Frontend -->|HTTP / WebSocket| Backend
    
    %% Backend to Services
    Backend -->|Voice/Tools| RealtimeService
    Backend -->|Planning| RecipeCleaner
    Backend -->|Recipe Generation| RecipeCreator
    Backend -->|Session Mgmt| SessionService
    Backend -->|Orchestration| CookingAgent
    
    %% Service Relationships
    RealtimeService -->|Uses| CookingAgent
    CookingAgent -->|Uses| RecipeCleaner
    CookingAgent -->|Uses| SessionService
    RealtimeService -->|Loads Tools| MCPTools
    MCPTools -->|Executes| CookingAgent
    
    %% External API Connections
    RealtimeService -->|WebSocket| OpenAIRealtime
    OpenAIRealtime -->|Tool Call| RealtimeService
    RecipeCleaner -->|HTTP| OpenAINano
    RecipeCreator -->|HTTP| OpenAINano
    
    %% Data Layer Connections
    Backend -->|SQL| PostgreSQL
    RecipeCleaner -->|Read/Write| PostgreSQL
    SessionService -->|Read/Write| PostgreSQL
    CookingAgent -->|Read| PostgreSQL
    RAGServer -->|Vector Search| Backend
    RAGServer -->|Read| PostgreSQL
    
    %% Styling
    classDef userLayer fill:#4a90e2,stroke:#2e5c8a,stroke-width:2px,color:#fff
    classDef backendLayer fill:#50c878,stroke:#2d7a4d,stroke-width:2px,color:#fff
    classDef serviceLayer fill:#f39c12,stroke:#b87333,stroke-width:2px,color:#fff
    classDef dataLayer fill:#9b59b6,stroke:#6c3483,stroke-width:2px,color:#fff
    classDef apiLayer fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    
    class User,VoiceTouch,Frontend userLayer
    class Backend backendLayer
    class RealtimeService,RecipeCleaner,RecipeCreator,SessionService,CookingAgent serviceLayer
    class PostgreSQL,RAGServer dataLayer
    class OpenAIRealtime,OpenAINano,MCPTools apiLayer
```

## 주요 컴포넌트 설명

### User Layer (사용자 계층)
- **User**: 최종 사용자
- **Voice/Touch**: 음성 및 터치 입력
- **Frontend (React)**: React 기반 프론트엔드 UI

### Backend Layer (백엔드 계층)
- **Backend (Express)**: Express.js 기반 백엔드 서버

### Service Layer (서비스 계층)
- **RealtimeServiceV3**: 실시간 음성 상호작용 처리 (gpt-realtime 사용)
- **RecipeCleaner**: 레시피 클리닝 및 Planning (gpt-5-nano 사용)
- **RecipeCreator**: AI 레시피 생성 (gpt-5-nano 사용)
- **SessionService**: 세션 관리 (DB CRUD)
- **CookingAgentV3**: 요리 세션 오케스트레이션

### Data Layer (데이터 계층)
- **PostgreSQL**: 메인 데이터베이스 (recipevoice)
  - `recipes`: 원본 레시피 데이터
  - `cleaned_recipes`: 정제된 레시피 데이터
  - `cleaned_steps`: 정제된 조리 단계
  - `cooking_sessions`: 요리 세션
  - `session_states`: 세션 상태 로그
- **RAG Server (FAISS)**: 의미 기반 레시피 검색

### External APIs (외부 API)
- **OpenAI Realtime API (gpt-realtime)**: 실시간 음성 대화
- **OpenAI API (gpt-5-nano)**: 레시피 생성 및 정제
- **MCP Tools**: Native Tool Calling (navigate_next_step, start_timer 등)

## 데이터 흐름

### 1. 레시피 클리닝 (사전 처리)
```
Raw Recipe → RecipeCleaner → gpt-5-nano → cleaned_recipes 테이블
```

### 2. 레시피 검색
```
User Query → Backend → RAG Server (FAISS) → PostgreSQL → Results
```

### 3. 세션 시작
```
Recipe ID → CookingAgentV3 → RecipeCleaner (데이터 로드)
         → SessionService (세션 생성) → PostgreSQL
```

### 4. 음성 상호작용
```
User Voice → Frontend → Backend → RealtimeServiceV3
         → OpenAI Realtime API (gpt-realtime)
         → Tool Call → MCP Tools → CookingAgentV3
         → SessionService (상태 업데이트) → PostgreSQL
```

## 모델별 역할

| 모델 | 용도 | 호출 서비스 |
|------|------|------------|
| **gpt-5-nano** | 레시피 클리닝/정제 | RecipeCleaner |
| **gpt-5-nano** | AI 레시피 생성 | RecipeCreator |
| **gpt-realtime** | 실시간 음성 대화 | RealtimeServiceV3 |

## 생성일
이 다이어그램은 `backend/scripts/generate_architecture_diagram.py`로 자동 생성되었습니다.
