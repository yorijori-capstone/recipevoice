# 요리조리 (Yorijori) V2 - AI 음성 요리 가이드

GPT-4o Realtime API를 활용한 실시간 음성 요리 가이드 시스템

## ⚡ 빠른 시작 (5분)

```bash
# 1. PostgreSQL 데이터베이스 생성 및 복원
psql -U postgres -c "CREATE DATABASE yorijori"
psql -U postgres -d yorijori < db_dumps/yorijori_full_backup.sql

# 2. Backend 실행
cd backend
npm install
npm run dev

# 3. Frontend 실행 (새 터미널)
cd frontend2
npm install
npm run dev
```

**완료!** http://localhost:5173 접속

## 📋 주요 기능

- ✅ **AI 레시피 생성**: GPT-4o-mini로 맞춤 레시피 생성
- ✅ **음성 요리 가이드**: GPT-4o-realtime으로 실시간 음성 상호작용
- ✅ **0.1초 빠른 시작**: 사전 Planning으로 즉시 요리 시작
- ✅ **자동 명령 처리**: LangChain으로 자연어 이해
- ✅ **실시간 동기화**: WebSocket으로 UI 자동 업데이트
- ✅ **세션 복구**: 페이지 새로고침 후에도 이어서 요리

## 🏗️ 시스템 아키텍처

```
[사용자] → [DashboardV2] → [레시피 검색/선택]
                ↓
         [CookingMode] → [음성 상호작용]
                ↓
    [WebSocket] → [RealtimeServiceV2]
                ↓
         [GPT-4o-realtime] (음성 입출력)
                ↓
         [LangChainAgent] (Intent Detection)
                ↓
         [CookingAgentV2] (세션 관리)
                ↓
         [PostgreSQL] (레시피 + Planning 데이터)
```

## 📊 성능

- **세션 시작**: 0.1초 (Planning 사전 완료)
- **Planning 시간**: 30초/레시피 (1회만 실행)
- **음성 응답**: 실시간 (GPT-4o-realtime)
- **레시피 개수**: 102개 (+ AI 생성 무제한)

## 📚 문서

- [SETUP.md](SETUP.md) - 개발 환경 설정 가이드
- [SYSTEM_FLOW.md](SYSTEM_FLOW.md) - 전체 시스템 흐름
- [Architecture.md](Architecture.md) - 아키텍처 상세 설명
- [CLEANUP_COMPLETE.md](CLEANUP_COMPLETE.md) - 코드 정리 내역

## 🛠️ 기술 스택

### Frontend
- React + TypeScript
- Vite
- Bootstrap 5
- WebSocket Client

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL
- OpenAI API (GPT-4o-realtime, GPT-4o-mini)
- LangChain
- WebSocket (ws)

## 🔧 개발 명령어

```bash
# Backend 개발 서버
cd backend
npm run dev

# Frontend 개발 서버
cd frontend2
npm run dev

# Backend 빌드
cd backend
npm run build

# Frontend 빌드
cd frontend2
npm run build

# Planning 실행 (처음 1회만, 50분 소요)
cd backend
npm run clean:all
```

## 📦 데이터베이스

### 테이블 구조:
- `recipes` - 원본 레시피 (102개)
- `ingredients` - 재료 목록
- `steps` - 원본 조리 단계
- `cleaned_recipes` - Planning 결과 (opening/closing remark)
- `cleaned_steps` - 단계별 스크립트 (GPT-4o-mini 생성)
- `cooking_sessions` - 세션 메타데이터
- `session_states` - 세션 상태 히스토리

### 데이터 복원:
```bash
# 전체 DB 복원 (추천)
psql -U postgres -d yorijori < db_dumps/yorijori_full_backup.sql

# 스키마만 생성
psql -U postgres -d yorijori -f backend/schema.sql
```

## 🎯 사용 방법

### 1. 레시피 검색
- 홈페이지에서 "김치" 검색
- 102개 레시피에서 즉시 검색

### 2. AI 레시피 생성
- 검색 결과 없을 때 "AI로 새 레시피 생성하기" 클릭
- "스테이크 레시피 만들어줘" 입력
- 30초 후 레시피 생성 완료

### 3. 음성 요리 가이드
- 레시피 선택 후 "요리 시작" 클릭
- "음성 상호작용 시작" 버튼 클릭
- "다음 단계로 가줘" 말하기
- 자동으로 다음 단계 이동 + 음성 안내

## 🔐 환경 변수

### Backend (.env)
```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://postgres:password@localhost:5432/yorijori
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 🤝 협업 가이드

1. **DB 공유**: `db_dumps/yorijori_full_backup.sql` 사용
2. **코드 리뷰**: Pull Request 생성
3. **이슈 트래킹**: GitHub Issues 사용
4. **문서 업데이트**: 기능 추가 시 문서도 함께 업데이트

## 📝 개발 워크플로우

```bash
# 1. 최신 코드 받기
git pull origin main

# 2. 의존성 업데이트
npm install

# 3. 개발 서버 실행
npm run dev

# 4. 빌드 테스트
npm run build

# 5. 커밋 & 푸시
git add .
git commit -m "feat: Add new feature"
git push origin feature-branch
```

## 🐛 문제 해결

### PostgreSQL 연결 실패
```bash
# Windows
net start postgresql-x64-14

# macOS/Linux
brew services start postgresql
```

### WebSocket 연결 실패
- Backend 서버가 실행 중인지 확인
- 포트 3001이 사용 가능한지 확인

### Planning 데이터 없음
```bash
# DB 덤프 복원 또는
psql -U postgres -d yorijori < db_dumps/yorijori_full_backup.sql

# Planning 실행 (50분 소요)
npm run clean:all
```

## 📄 라이선스

MIT

## 👥 팀

- 개발자: [Your Name]
- 문의: [Your Email]
