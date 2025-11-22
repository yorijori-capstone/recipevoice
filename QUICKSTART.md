# 🚀 빠른 시작 가이드 (V3)

> **소요 시간**: 5분
> **전제 조건**: Node.js 18+, PostgreSQL 14+, OpenAI API Key

---

## 1️⃣ 데이터베이스 복원 (1분)

```bash
# PostgreSQL 데이터베이스 생성
psql -U postgres -c "CREATE DATABASE \"recipe-db\";"

# dump 파일로 전체 복원
cd last_project
pg_restore -U postgres -d "recipe-db" db_dumps/recipe_db_backup.dump
```

**확인:**

```bash
psql -U postgres -d "recipe-db" -c "SELECT COUNT(*) FROM cleaned_recipes;"
# 결과: 102 (Planning 완료된 레시피)
```

---

## 2️⃣ 환경 변수 설정 (30초)

### Backend `.env` 파일 생성:

`backend/.env` 파일 내용:

```env
OPENAI_API_KEY=sk-여기에_OpenAI_API_Key_입력
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/recipe-db
PORT=3001
NODE_ENV=development
```

### Frontend `.env` 파일 생성:

`frontend2/.env` 파일 내용:

```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 3️⃣ 서버 실행 (2분)

### Terminal 1 - Backend:

```bash
cd backend
npm install
npm run dev
```

**성공 메시지:**

```
🚀 Server V3 running on port 3001
✅ PostgreSQL connected
✅ MCP Client initialized (7 tools)
✅ WebSocket server ready
```

### Terminal 2 - Frontend:

```bash
cd frontend2
npm install
npm run dev
```

**성공 메시지:**

```
VITE v5.4.21  ready in 500 ms
➜  Local:   http://localhost:5173/
```

---

## 4️⃣ 테스트 (1분)

1. **브라우저 접속**: http://localhost:5173
2. **레시피 검색**: "김치" 또는 "미역국" 입력
3. **요리 시작**: 아무 레시피 선택 → "요리 시작" 클릭
4. **음성 테스트**:
   - "음성 대화 ON" 버튼 클릭
   - "안녕" → AI가 레시피와 재료 소개
   - "시작" → 첫 번째 단계 안내 시작
   - "다음 단계로 가줘" → 자동 이동

---

## ✅ 체크리스트

- [ ] PostgreSQL 설치 및 실행 중
- [ ] `recipe-db` 데이터베이스 생성
- [ ] dump 파일 복원 (102개 레시피 확인)
- [ ] Backend `.env` 파일 생성 (OpenAI API Key 입력)
- [ ] Frontend `.env` 파일 생성
- [ ] Backend 서버 실행 (`npm run dev`)
- [ ] Frontend 서버 실행 (`npm run dev`)
- [ ] http://localhost:5173 접속 확인
- [ ] 레시피 검색 테스트
- [ ] 음성 대화 테스트

---

## 🐛 문제 발생 시

### "Cannot connect to PostgreSQL"

```bash
# PostgreSQL 서비스 시작
# Windows:
net start postgresql-x64-14

# macOS:
brew services start postgresql

# Linux:
sudo systemctl start postgresql
```

### "database recipe-db does not exist"

```bash
# 데이터베이스 생성 (큰따옴표 필수!)
psql -U postgres -c "CREATE DATABASE \"recipe-db\";"
```

### "cleaned_recipes table is empty"

```bash
# dump 파일 다시 복원
pg_restore -U postgres -d "recipe-db" db_dumps/recipe_db_backup.dump
```

### "OpenAI API Error"

- Backend `.env` 파일의 `OPENAI_API_KEY` 확인
- API Key가 유효한지 확인: https://platform.openai.com/api-keys
- gpt-realtime 모델 사용 가능한지 확인

### "Port 3001 already in use"

```bash
# 기존 프로세스 종료 후 재실행
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3001 | xargs kill -9
```

### "MCP tools not loaded"

- Backend 콘솔에서 `[RealtimeServiceV3] Loaded 7 MCP tools` 확인
- 로드 안 됐으면 서버 재시작

---

## 📚 다음 단계

- [Architecture.md](Architecture.md) - V3 아키텍처 문서
- [SETUP.md](SETUP.md) - 상세 설정 가이드
- [SYSTEM_FLOW.md](SYSTEM_FLOW.md) - 시스템 전체 흐름

---

## 💡 팁

### Planning 없이 시작했다면?

```bash
# 약 50분 소요 (102개 레시피 Planning)
cd backend
npm run clean:all
```

### DB 덤프 파일이 없다면?

1. 팀장에게 `db_dumps/recipe_db_backup.dump` 파일 요청
2. 또는 직접 Planning 실행 (`npm run clean:all`)

### Git에서 DB 덤프 받기:

```bash
git pull origin main
# db_dumps/recipe_db_backup.dump 파일 자동 다운로드
```

---

## 🎯 V3 주요 특징

| 기능                    | 설명                                         |
| ----------------------- | -------------------------------------------- |
| **Native Tool Calling** | LangChain 없이 OpenAI Realtime API 직접 사용 |
| **MCP Protocol**        | 7개 표준화된 도구 (navigate, timer, get)     |
| **gpt-realtime**        | 최신 Realtime API 모델                       |
| **Timer Sync**          | AI가 타이머 상태 실시간 인식                 |
| **인사 흐름**           | "안녕" → 소개 → "시작" → 요리 시작           |
