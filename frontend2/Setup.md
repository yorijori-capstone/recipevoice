# 🎙️ Voice Agent 설치 및 실행 가이드

## 📁 파일 구조

```
frontend/
├── src/
│   ├── components/
│   │   ├── RecipeCard.tsx (기존)
│   │   ├── SearchBar.tsx (기존)
│   │   └── VoiceAgent/
│   │       ├── StatusDisplay.tsx        ✨ 새로 추가
│   │       ├── TranscriptView.tsx       ✨ 새로 추가
│   │       ├── ConsoleLog.tsx           ✨ 새로 추가
│   │       └── ControlPanel.tsx         ✨ 새로 추가
│   ├── pages/
│   │   ├── Dashboard.tsx (기존)
│   │   ├── RecipeDetail.tsx (기존)
│   │   └── VoiceGuidance.tsx            ✨ 새로 추가
│   ├── hooks/
│   │   ├── useVoiceAgent.ts             ✨ 새로 추가
│   │   └── useAudioQueue.ts             ✨ 새로 추가
│   ├── utils/
│   │   └── audioProcessor.ts            ✨ 새로 추가
│   ├── types/
│   │   └── voice.ts                     ✨ 새로 추가
│   ├── App.tsx (기존 - /voice 라우트 이미 있음)
│   ├── main.tsx (Bootstrap JS 추가 필요)
│   ├── index.css (기존)
│   └── vite-env.d.ts (env 타입 추가 필요)
├── .env                                  ✨ 새로 추가
├── .env.example                          ✨ 새로 추가
└── package.json (의존성 확인)
```

## 🚀 설치 단계

### 1. 환경 변수 설정

루트에 `.env` 파일 생성:

```bash
VITE_OPENAI_API_KEY=sk-proj-your-api-key-here
```

### 2. 의존성 확인

`package.json`에 다음이 있는지 확인:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "bootstrap": "^5.3.0"
  }
}
```

없으면 설치:

```bash
npm install react react-dom react-router-dom bootstrap
```

### 3. TypeScript 설정 확인

`tsconfig.json`에 다음 설정이 있는지 확인:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 4. 개발 서버 실행

```bash
npm run dev
```

## 🎯 사용 방법

### 1. 레시피 선택

- Dashboard에서 레시피 선택

### 2. 음성 안내 준비

- RecipeDetail 페이지에서 "음성 안내 준비" 클릭
- 백엔드 Planning 완료 후 "안내 시작" 버튼 활성화

### 3. 음성 안내 시작

- "안내 시작" 클릭 → `/recipe/{id}/voice` 페이지로 이동
- "🎙️ 음성 안내 시작" 버튼 클릭
- 마이크 권한 허용
- "✅ 연결됨" 상태가 되면 말하기 시작!

## 💬 대화 예시

```
👤 "첫 번째 단계 알려줘"
🤖 "네, 첫 번째 단계는 김치 1컵을 잘게 썰어주세요..."

👤 "지금 몇 분 지났어?"
🤖 "아직 타이머를 시작하지 않았어요. 첫 번째 단계부터..."

👤 "다음 단계 뭐야?"
🤖 "다음은 팬에 기름을 두르고..."
```

## 🔧 트러블슈팅

### 문제 1: 마이크 권한 오류

**해결**: 브라우저 설정 → 사이트 권한 → 마이크 허용

### 문제 2: API Key 오류

**해결**: `.env` 파일 확인 및 `VITE_` 접두사 확인

### 문제 3: 음성이 안 들림

**해결**:

- 스피커 볼륨 확인
- 콘솔에서 오디오 재생 오류 확인
- `🔊 오디오 수신 완료` 로그 확인

### 문제 4: 영어로 답변함

**해결**: 레시피 컨텍스트가 제대로 로드되었는지 확인

## 📊 상태 흐름

```
idle (대기)
  ↓ [음성 안내 시작 클릭]
connecting (연결 중)
  ↓ [WebSocket 연결 + 마이크 권한]
connected (연결됨)
  ↓ [사용자 말하기]
  ↓ [에이전트 응답]
  ↓ [안내 종료 클릭]
disconnected (종료)
```

## 🎨 UI 구성

1. **StatusDisplay**: 현재 연결 상태
2. **ControlPanel**: 시작/종료 버튼
3. **TranscriptView**: 대화 내역 (사용자 ↔ 에이전트)
4. **ConsoleLog**: 시스템 로그 (디버깅용)
5. **Recipe Accordion**: 레시피 정보 (접기/펼치기)

## 🔐 보안 주의사항

⚠️ **중요**:

- `.env` 파일은 **절대** Git에 커밋하지 마세요!
- `.gitignore`에 `.env` 추가 확인
- API Key는 브라우저에 노출됩니다 (개발용만 사용)
- 프로덕션에서는 백엔드에서 토큰 관리 필수!

## 📝 다음 단계 (Phase 2)

이후 백엔드 연동 시:

```
Browser (현재 완성)
   ↓ WebSocket
Backend Server (FastAPI/Node.js)
   ↓ REST API
LangChain Agent (MCP + RAG)
```

현재는 **OpenAI Realtime API를 직접 호출**하지만,
나중에 백엔드를 통해 MCP 서버와 연동할 수 있습니다!
