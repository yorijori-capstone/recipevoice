g# 🚀 빠른 시작 가이드 (V3)

> **소요 시간**: 5분
> **전제 조건**: Node.js 18+, PostgreSQL 14+, OpenAI API Key

---

## 1️⃣ 데이터베이스 복원 (2분)

```bash
# 1) PostgreSQL 데이터베이스 생성
psql -U postgres -c "DROP DATABASE IF EXISTS recipevoice;"
psql -U postgres -c "CREATE DATABASE recipevoice;"

# 2) 사용자 생성 (없는 경우)
psql -U postgres -c "CREATE USER recipevoice WITH PASSWORD 'recipevoice';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice;"

# 3) 마이그레이션 실행
psql -U recipevoice -d recipevoice -f backend/migrations/001_create_cleaned_recipes.sql
psql -U recipevoice -d recipevoice -f backend/migrations/002_create_sessions.sql
psql -U recipevoice -d recipevoice -f backend/migrations/004_add_raw_data_column.sql
psql -U recipevoice -d recipevoice -f backend/migrations/005_grant_permissions.sql

# 4) 덤프 파일 복원 (있는 경우)
# 방법 A: psql 사용 (PostgreSQL 클라이언트 도구 필요)
psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup_*.sql

# 방법 B: Python 스크립트 사용 (pg_dump/psql 없이도 가능)
# poetry run python backend/scripts/db_restore.py db_dumps/recipevoice_backup_*.sql
```

**확인:**

```bash
psql -U recipevoice -d recipevoice -c "\dt"
# 7개 테이블 확인: cleaned_recipes, cleaned_steps, cooking_sessions, ingredients, recipes, session_states, steps

psql -U recipevoice -d recipevoice -c "SELECT COUNT(*) FROM cleaned_recipes;"
# 결과: 클리닝 완료된 레시피 개수 확인
```

> **참고**: `transaction_timeout` 은 PostgreSQL 14+ 전용 설정이지만, 클라이언트 버전 차이로 오류가 발생할 수 있습니다. 위 방법은 이를 우회하여 안전하게 복원합니다.

---

## 2️⃣ 환경 변수 설정 (30초)

### Backend `.env` 파일 생성:

`backend/.env` 파일 내용:

```env
OPENAI_API_KEY=sk-여기에_OpenAI_API_Key_입력
DATABASE_URL=postgresql://recipevoice:recipevoice@localhost:5432/recipevoice
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

### "database recipevoice does not exist"

```bash
# 데이터베이스 생성
psql -U postgres -c "CREATE DATABASE recipevoice;"
psql -U postgres -c "CREATE USER recipevoice WITH PASSWORD 'recipevoice';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice;"
```

### "cleaned_recipes table is empty"

```bash
# 레시피 import 및 클리닝 실행
cd backend
npm run import
# 또는
npm run clean:all
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

### "psql: command not found" 또는 "pg_dump: command not found"

PostgreSQL 클라이언트 도구가 설치되지 않은 경우:

**해결 방법 1: PostgreSQL 클라이언트 도구 설치**
1. PostgreSQL 설치 프로그램 재실행
2. "Modify" 선택
3. "Command Line Tools" 옵션 체크
4. 설치 완료

**해결 방법 2: Python 스크립트 사용 (권장)**
```bash
# 덤프 생성
poetry run python backend/scripts/db_dump.py

# 덤프 복원 (psql 대신)
# SQL 파일을 직접 편집하거나, Python 스크립트로 복원 가능
```

> **참고**: Poetry 환경에서 `psycopg`를 통해 데이터베이스 작업이 가능합니다.

---

## 📚 다음 단계

- [Architecture.md](Architecture.md) - V3 아키텍처 문서
- [SETUP.md](SETUP.md) - 상세 설정 가이드
- [SYSTEM_FLOW.md](SYSTEM_FLOW.md) - 시스템 전체 흐름

---

## 💡 팁

### Planning 없이 시작했다면?

```bash
# 약 50분 소요 (102개 레시피 Planning, gpt-5-nano 사용)
cd backend
npm run import  # raw data import
npm run clean:all  # 클리닝 및 planning
```

### 데이터베이스 덤프 생성 (팀 공유용)

**PostgreSQL 클라이언트 도구가 있는 경우:**
```bash
# pg_dump 사용
pg_dump -U recipevoice -d recipevoice > db_dumps/recipevoice_backup.sql
```

**PostgreSQL 클라이언트 도구가 없는 경우 (Python 스크립트 사용):**
```bash
# Poetry 환경에서 실행
poetry run python backend/scripts/db_dump.py

# 덤프 파일이 db_dumps/ 폴더에 생성됨
# 예: db_dumps/recipevoice_backup_20250123_143022.sql
```

> **참고**: `pg_dump` 명령어가 없다면 Python 스크립트를 사용하세요. Poetry 환경에서 `psycopg`를 통해 덤프를 생성합니다.

### FAISS 인덱스 구축 (RAG 검색 사용 시)

**방법 1: Git에서 받기 (추천)**

```bash
# Git pull 후 Index 파일 자동 다운로드
git pull origin main
# rag-server/storage/faiss.index 파일이 자동으로 다운로드됨
```

**방법 2: 직접 구축 (Index 파일이 없을 때만)**

```bash
cd rag-server
python build_index.py
# 임베딩 생성 및 FAISS 인덱스 구축 (약 5-10분 소요)
```

---

## 🎯 V3 주요 특징

| 기능                    | 설명                                         |
| ----------------------- | -------------------------------------------- |
| **Native Tool Calling** | LangChain 없이 OpenAI Realtime API 직접 사용 |
| **MCP Protocol**        | 7개 표준화된 도구 (navigate, timer, get)     |
| **gpt-realtime**        | 최신 Realtime API 모델                       |
| **gpt-5-nano**          | 레시피 정제 및 Planning에 사용              |
| **RAG 검색**            | FAISS 기반 의미 기반 레시피 검색             |
| **Timer Sync**          | AI가 타이머 상태 실시간 인식                 |
| **인사 흐름**           | "안녕" → 소개 → "시작" → 요리 시작           |
