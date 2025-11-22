# 요리조리(Yorijori) V2 개발 환경 설정 가이드

## ⚡ 빠른 시작

`README.md`의 [빠른 시작 가이드](README.md#⚡-빠른-시작-5분)를 참고하세요.

## 1. 사전 요구사항

- **Node.js 18+** (필수)
- **PostgreSQL 14+** (필수)
- **OpenAI API Key** (필수)
- npm 또는 yarn

## 2. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 클론
git clone <repository-url>
cd last_project

# Backend 의존성 설치
cd backend
npm install

# Frontend 의존성 설치
cd ../frontend
npm install
```

## 3. PostgreSQL 데이터베이스 설정

### ⭐ 방법 1: SQL 덤프로 즉시 복원 (추천)

이 방법을 사용하면 **Planning 완료된 102개 레시피**를 즉시 사용할 수 있습니다.

```bash
# 1. 데이터베이스 생성
psql -U postgres

postgres=# CREATE DATABASE "recipe-db";
postgres=# \q

# 2. SQL 덤프 파일로 전체 복원 (스키마 + 데이터)
cd last_project
psql -U postgres -d "recipe-db" < db_dumps/yorijori_full_backup.sql

# 3. 복원 확인
psql -U postgres -d "recipe-db"

recipe-db=# SELECT COUNT(*) FROM recipes;
 count
-------
   102
(1 row)

recipe-db=# SELECT COUNT(*) FROM cleaned_recipes;
 count
-------
   102
(1 row)

recipe-db=# \q
```

**완료!** 이제 바로 서버를 실행할 수 있습니다.

---

### 방법 2: 수동 스키마 생성 + Planning 실행 (50분 소요)

덤프 파일이 없거나 처음부터 설정하려면 이 방법을 사용하세요.

#### 3-1. 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE "recipe-db";

# 연결 확인
\c "recipe-db"
\q
```

#### 3-2. 스키마 생성

```bash
# backend 디렉토리에서 실행
cd backend
psql -U postgres -d "recipe-db" -f schema.sql
```

#### 3-3. 원본 레시피 Import + Planning 실행

**⚠️ 주의: 이 과정은 약 50분 소요됩니다!**

```bash
cd backend

# 1. 원본 레시피 102개 Import
npm run import

# 2. Planning 실행 (GPT-4o-mini로 스크립트 생성)
npm run clean:all
```

---

## 3-4. 데이터베이스 덤프 생성 (팀장/공유자용)

팀원들과 데이터베이스를 공유하려면 덤프 파일을 생성하세요.

### ✅ SQL 형식 (추천 - Git에 포함 가능)

```bash
# 전체 데이터베이스 덤프 생성
pg_dump -U postgres -d "recipe-db" > db_dumps/yorijori_full_backup.sql

# Git에 추가
git add db_dumps/yorijori_full_backup.sql
git commit -m "Add database dump with 102 cleaned recipes"
git push
```

### 대안: Binary 형식 (파일 크기 작음)

```bash
# Binary 덤프 생성 (압축됨)
pg_dump -U postgres -d "recipe-db" -F c -f db_dumps/yorijori_backup.dump

# 복원 방법 (팀원):
pg_restore -U postgres -d "recipe-db" -c db_dumps/yorijori_backup.dump
```

### Planning 결과만 공유 (가벼움)

```bash
# cleaned_recipes + cleaned_steps만 덤프
pg_dump -U postgres -d "recipe-db" \
  -t cleaned_recipes \
  -t cleaned_steps \
  -t recipes \
  -t ingredients \
  -t steps \
  > db_dumps/cleaned_recipes_only.sql

# 팀원 복원:
psql -U postgres -d "recipe-db" -f schema.sql
psql -U postgres -d "recipe-db" < db_dumps/cleaned_recipes_only.sql
```

## 4. 환경 변수 설정

### Backend 설정

`backend/.env` 파일 생성:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/recipe-db

# Server
PORT=3001
NODE_ENV=development

# Optional: MCP Configuration
MCP_ENABLED=false
```

### Frontend 설정

`frontend/.env` 파일 생성:

```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 5. 데이터베이스 확인

```bash
# PostgreSQL 접속
psql -U postgres -d "recipe-db"

# 테이블 확인
\dt

# 데이터 확인
SELECT COUNT(*) FROM recipes;           -- 원본 레시피 (102개 기대)
SELECT COUNT(*) FROM cleaned_recipes;   -- Planning 완료된 레시피
SELECT COUNT(*) FROM cleaned_steps;     -- 단계별 스크립트

# 접속 종료
\q
```

## 6. Planning 실행 (데이터 복원 안 한 경우)

**주의: 이 과정은 시간이 오래 걸립니다 (102개 레시피 × 30초 = 약 50분)**

```bash
cd backend

# 원본 레시피 로드 + Planning 실행
npm run clean:all
```

**데이터베이스 덤프를 받았다면 이 단계는 건너뛰세요!**

## 7. 서버 실행

### Backend 서버 (Terminal 1)

```bash
cd backend

# 개발 모드 (자동 재시작)
npm run dev:v2

# 또는 프로덕션 모드
npm run build
npm start
```

서버가 정상 실행되면:

```
🚀 Server V2 running on port 3001
✅ PostgreSQL connected
✅ WebSocket server ready
```

### Frontend 서버 (Terminal 2)

```bash
cd frontend

# 개발 모드
npm run dev

# 또는 프로덕션 빌드
npm run build
npm run preview
```

Frontend 접속: http://localhost:5173

## 8. 동작 확인

### 8-1. API Health Check

```bash
# Backend API 확인
curl http://localhost:3001/api/cooking/v2/health

# 기대 응답:
# {"status":"healthy","version":"v2"}
```

### 8-2. 데이터베이스 연결 확인

```bash
# 레시피 목록 조회
curl http://localhost:3001/api/recipes?limit=5
```

### 8-3. Frontend 확인

1. http://localhost:5173 접속
2. 검색창에 "김치" 입력
3. 레시피 카드가 표시되면 성공
4. "요리 시작" 버튼 클릭하여 CookingMode 진입

## 9. 문제 해결

### 문제 1: PostgreSQL 연결 실패

```bash
# PostgreSQL 서비스 확인
# Windows
net start postgresql-x64-14

# macOS/Linux
sudo systemctl start postgresql
# 또는
brew services start postgresql
```

### 문제 2: cleaned_recipes 테이블이 비어있음

```sql
-- 데이터 확인
SELECT COUNT(*) FROM cleaned_recipes;

-- 0이면 Planning 실행 필요
-- Terminal에서:
cd backend
npm run clean:all
```

### 문제 3: OpenAI API 오류

```bash
# .env 파일 확인
cat backend/.env | grep OPENAI_API_KEY

# API Key 유효성 확인
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 문제 4: WebSocket 연결 실패

```bash
# Backend 로그 확인
# "WebSocket server ready" 메시지 확인

# Frontend 브라우저 콘솔 확인
# "Connected to backend WebSocket" 메시지 확인
```

### 문제 5: npm install 실패

```bash
# Node.js 버전 확인
node --version  # 18 이상 필요

# npm 캐시 정리
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 10. 데이터베이스 공유 방법 (팀장용)

### 방법 1: 전체 덤프 생성 및 공유

```bash
# 1. 덤프 생성 (Planning 결과 포함)
pg_dump -U postgres -d yorijori -F c -f yorijori_full_$(date +%Y%m%d).dump

# 2. 파일 공유 (Google Drive, GitHub Release 등)
# yorijori_full_20250121.dump

# 3. 팀원에게 복원 명령 전달
# pg_restore -U postgres -d yorijori -c yorijori_full_20250121.dump
```

### 방법 2: Git에 SQL 덤프 포함

```bash
# .gitignore에서 덤프 파일 제외
echo "!db_dumps/*.sql" >> .gitignore

# SQL 덤프 생성
mkdir -p db_dumps
pg_dump -U postgres -d "recipe-db" --data-only -t cleaned_recipes -t cleaned_steps > db_dumps/cleaned_data.sql

# Git에 커밋
git add db_dumps/cleaned_data.sql
git commit -m "Add cleaned recipe database dump"
git push
```

### 방법 3: 클라우드 PostgreSQL 사용 (추천)

**Supabase, Railway, Render 등 무료 PostgreSQL 호스팅**

```env
# 모든 팀원이 같은 DB 사용
DATABASE_URL=postgresql://user:password@db.example.com:5432/recipe-db
```

장점:

- ✅ 덤프 파일 공유 불필요
- ✅ 실시간 데이터 동기화
- ✅ 백업 자동화

## 11. 개발 워크플로우

### 새로운 기능 개발 시:

```bash
# 1. 최신 코드 받기
git pull origin main

# 2. 의존성 업데이트
cd backend && npm install
cd ../frontend && npm install

# 3. 데이터베이스 마이그레이션 (스키마 변경 시)
psql -U postgres -d "recipe-db" < backend/migrations/001_new_feature.sql

# 4. 개발 서버 실행
npm run dev:v2  # Backend
npm run dev     # Frontend
```

### 코드 리뷰 전:

```bash
# 1. 타입 체크
cd backend && npm run type-check
cd ../frontend && npm run type-check

# 2. 빌드 테스트
cd backend && npm run build
cd ../frontend && npm run build

# 3. 커밋 & 푸시
git add .
git commit -m "feat: Add new feature"
git push origin feature-branch
```

## 12. 유용한 명령어

```bash
# Backend 개발 서버 (자동 재시작)
npm run dev:v2

# Frontend 개발 서버 (HMR)
npm run dev

# 전체 레시피 다시 Planning (50분 소요)
npm run clean:all

# AI 레시피 생성 테스트
curl -X POST http://localhost:3001/api/recipes/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"스테이크 레시피"}'

# 데이터베이스 백업
pg_dump -U postgres -d "recipe-db" > backup_$(date +%Y%m%d).sql

# 데이터베이스 초기화 (주의!)
psql -U postgres -d "recipe-db" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -U postgres -d "recipe-db" -f backend/schema.sql
```

## 13. 프로젝트 구조

```
last_project/
├── backend/
│   ├── src/
│   │   ├── agents/         # CookingAgentV2, LangChainAgent
│   │   ├── services/       # RealtimeServiceV2, Planning, etc
│   │   ├── routes/         # API endpoints
│   │   └── serverV2.ts     # Main server
│   ├── schema.sql          # DB 스키마
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # DashboardV2, CookingMode
│   │   ├── components/     # RecipeCard, VoiceInteraction
│   │   └── hooks/          # useCookingSessionV2, useWebSocket
│   └── package.json
│
├── Architecture.md         # 시스템 아키텍처 문서
├── SYSTEM_FLOW.md          # 전체 흐름 설명
└── SETUP.md                # 이 문서
```

## 14. 주요 기능 테스트

### 레시피 검색:

1. http://localhost:5173 접속
2. 검색창에 "김치" 입력
3. 결과 확인

### AI 레시피 생성:

1. 검색 결과 없을 때 "AI로 새 레시피 생성하기" 버튼 클릭
2. "스테이크 레시피 만들어줘" 입력
3. 생성 대기 (30초)
4. 생성된 레시피 확인

### 음성 요리 가이드:

1. 레시피 선택 후 "요리 시작" 클릭
2. "음성 상호작용 시작" 버튼 클릭
3. "다음 단계로 가줘" 말하기
4. 자동 단계 이동 확인

### AI 레시피 삭제:

1. DashboardV2에서 "AI 생성" 배지 확인
2. 🗑️ 버튼 클릭
3. 삭제 확인

## 15. 환경별 설정

### 개발 환경 (Development)

```env
NODE_ENV=development
VITE_API_URL=http://localhost:3001
```

### 프로덕션 환경 (Production)

```env
NODE_ENV=production
VITE_API_URL=https://api.yorijori.com
DATABASE_URL=postgresql://user:pass@prod-db.com:5432/recipe-db
```

## 16. 팀원 온보딩 체크리스트

- [ ] Node.js 18+ 설치
- [ ] PostgreSQL 설치 및 실행
- [ ] 프로젝트 클론
- [ ] Backend 의존성 설치 (`npm install`)
- [ ] Frontend 의존성 설치 (`npm install`)
- [ ] `.env` 파일 생성 (Backend, Frontend)
- [ ] OpenAI API Key 발급 및 설정
- [ ] 데이터베이스 생성 (`CREATE DATABASE "recipe-db"`)
- [ ] 스키마 생성 (`psql -f schema.sql`)
- [ ] **데이터베이스 덤프 복원** (`pg_restore`)
- [ ] Backend 서버 실행 (`npm run dev:v2`)
- [ ] Frontend 서버 실행 (`npm run dev`)
- [ ] Health Check 확인 (`/api/cooking/v2/health`)
- [ ] 브라우저에서 검색 테스트
- [ ] 요리 세션 시작 테스트

**예상 소요 시간**: 30분 (데이터베이스 덤프 사용 시)

---

문제가 발생하면 [SYSTEM_FLOW.md](SYSTEM_FLOW.md)와 [Architecture.md](Architecture.md)를 참고하세요.
