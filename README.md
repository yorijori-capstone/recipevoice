# 🍳 요리조리 (Yorijori) V3

**AI 음성 요리 가이드 시스템**

> **"말 한마디로 시작하는 스마트한 요리 생활"**
>
> gpt-5-nano와 OpenAI Realtime API를 활용하여, 복잡한 레시피를 실시간 음성 대화로 안내해주는 지능형 요리 어시스턴트입니다.

---

## ✨ 주요 기능

- **🗣️ 실시간 음성 대화**: "다음 단계로 가줘", "타이머 5분 맞춰줘" 등 자연어로 요리 제어
- **⚡ 0.1초 즉시 시작**: 사전 Planning 기술로 대기 시간 없이 바로 요리 시작
- **🤖 AI 레시피 생성**: 없는 레시피도 `gpt-5-nano`가 즉석에서 생성 및 구조화
- **🔍 의미 기반 검색 (RAG)**: "매콤한 국물 요리"처럼 개떡같이 말해도 찰떡같이 검색
- **⏱️ 스마트 타이머**: 요리 단계와 연동된 타이머 자동 설정 및 알림

---

## 🏗️ 시스템 아키텍처 (V3)

단일 **Express Backend**와 **OpenAI Realtime API**의 강력한 통합으로 심플하고 빠른 구조를 완성했습니다.

```mermaid
graph LR
    User((User)) <--> Frontend[React Frontend]
    Frontend <--> Backend[Express Backend]
    Backend <--> OpenAI[OpenAI Realtime API]
    Backend <--> DB[(PostgreSQL)]
    Backend <--> RAG[FAISS Search]
```

자세한 기술 구조는 [ARCHITECTURE.md](ARCHITECTURE.md)를 참고하세요.

---

## 📺 YouTube 기반 레시피 수집 (MCP)

`zubeid-youtube-mcp-server`를 통해 **검색 → 영상 선택 → 자막 추출 → RecipeCleaner** 까지 한 번에 이어지는 파이프라인을 준비했습니다.

1. **환경 변수 설정 (`backend/.env`)**
   ```env
   YOUTUBE_API_KEY=AIza...
   YOUTUBE_TRANSCRIPT_LANG=ko
   ```
2. **MCP 서버 실행**
   ```bash
   cd backend
   npm install
   npm run youtube:mcp
   ```
3. **백엔드 연동 흐름**
   - `GET /api/youtube/search?query=김치찌개&limit=5` → MCP `videos.searchVideos`
   - `POST /api/youtube/import` (body: `videoId`, `language=ko`, `searchQuery`) → MCP `videos.getVideo` + `transcripts.getTranscript`
   - `recipe_id = recipe_yt_<videoId>` 규칙으로 `recipes.raw_data` 저장 후 `RecipeCleaner.cleanAndPlanRecipe` 실행
   - raw 데이터에는 `title`, `description`, `channelTitle`, `duration`, `thumbnails URL`, `transcript`, `statistics`, `searchQuery`, `retrievedAt`, `source` 등을 JSON 으로 유지

자세한 명세는 [`docs/youtube-mcp-search-pipeline.md`](docs/youtube-mcp-search-pipeline.md)를 참고하세요.

---

## 🚀 시작하기

### 개발자 가이드
프로젝트 설치, 실행, 트러블슈팅에 대한 상세한 내용은 아래 가이드를 확인하세요.

👉 **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**

#### 시스템 플로우
```
[사용자] → [DashboardV3] → [레시피 검색/선택]
                ↓
         [CookingMode] → [음성 상호작용]
                ↓
    [WebSocket] → [RealtimeServiceV3]
                ↓
         [gpt-realtime] (음성 입출력)
                ↓
         [MCP Tool Calling] (Native Tool Execution)
                ↓
         [CookingAgentV3] (세션 관리)
                ↓
         [PostgreSQL] (레시피 + Planning 데이터)
```

### 기술 스택
- **Frontend**: React, TypeScript, Vite, WebSocket
- **Backend**: Node.js, Express, TypeScript
- **AI**: OpenAI Realtime API (Voice), gpt-5-nano (Reasoning)
- **Database**: PostgreSQL, FAISS (Vector DB)

---

## 👥 팀

- **개발**: **요리조리** 팀
   - 서강대학교 미디어&엔터테인먼트학과 노승혁 (팀장)
   - 서강대학교 전자공학과 김재성
   - 서강대학교 국어국문학과 김현서
   - 서강대학교 심리학과 엄태림
   - 서강대학교 경영학과 이다빈

---
