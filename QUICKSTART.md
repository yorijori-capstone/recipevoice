# 🚀 협업 개발자 빠른 시작 가이드

> **소요 시간**: 5분
> **전제 조건**: Node.js 18+, PostgreSQL 14+, OpenAI API Key

## 1️⃣ 데이터베이스 복원 (1분)

```bash
# PostgreSQL 데이터베이스 생성
psql -U postgres

postgres=# CREATE DATABASE yorijori;
postgres=# \q

# SQL 덤프 파일로 전체 복원
cd last_project
psql -U postgres -d yorijori < db_dumps/yorijori_full_backup.sql
```

**확인:**

```bash
psql -U postgres -d yorijori -c "SELECT COUNT(*) FROM cleaned_recipes;"
# 결과: 102 (Planning 완료된 레시피)
```

## 2️⃣ 환경 변수 설정 (30초)

### Backend `.env` 파일 생성:

```bash
cd backend
cat > .env << 'EOF'
OPENAI_API_KEY=여기에_OpenAI_API_Key_입력
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/yorijori
PORT=3001
NODE_ENV=development
EOF
```

### Frontend `.env` 파일 생성:

```bash
cd frontend2
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
EOF
```

## 3️⃣ 서버 실행 (2분)

### Terminal 1 - Backend:

```bash
cd backend
npm install
npm run dev
```

**성공 메시지:**

```
🚀 Server V2 running on port 3001
✅ PostgreSQL connected
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

## 4️⃣ 테스트 (1분)

1. **브라우저 접속**: http://localhost:5173
2. **레시피 검색**: "김치" 입력
3. **요리 시작**: 아무 레시피 선택 → "요리 시작" 클릭
4. **음성 테스트**: "음성 상호작용 시작" → "다음 단계로 가줘" 말하기

---

## ✅ 체크리스트

- [ ] PostgreSQL 설치 및 실행 중
- [ ] yorijori 데이터베이스 생성
- [ ] SQL 덤프 복원 (102개 레시피 확인)
- [ ] Backend `.env` 파일 생성 (OpenAI API Key 입력)
- [ ] Frontend `.env` 파일 생성
- [ ] Backend 서버 실행 (`npm run dev`)
- [ ] Frontend 서버 실행 (`npm run dev`)
- [ ] http://localhost:5173 접속 확인
- [ ] 레시피 검색 테스트

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

### "cleaned_recipes table is empty"

```bash
# SQL 덤프 다시 복원
psql -U postgres -d yorijori < db_dumps/yorijori_full_backup.sql
```

### "OpenAI API Error"

- Backend `.env` 파일의 `OPENAI_API_KEY` 확인
- API Key가 유효한지 확인: https://platform.openai.com/api-keys

### "Port 3001 already in use"

```bash
# 기존 프로세스 종료 후 재실행
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3001 | xargs kill -9
```

---

## 📚 다음 단계

- [SETUP.md](SETUP.md) - 상세 설정 가이드
- [SYSTEM_FLOW.md](SYSTEM_FLOW.md) - 시스템 전체 흐름
- [Architecture.md](Architecture.md) - 아키텍처 문서

---

## 💡 팁

### Planning 없이 시작했다면?

```bash
# 50분 소요 (102개 레시피 Planning)
cd backend
npm run clean:all
```

### DB 덤프 파일이 없다면?

1. 팀장에게 `db_dumps/yorijori_full_backup.sql` 파일 요청
2. 또는 직접 Planning 실행 (`npm run clean:all`)

### Git에서 DB 덤프 받기:

```bash
git pull origin main
# db_dumps/yorijori_full_backup.sql 파일 자동 다운로드
```
