# 요리조리(Yorijori) V2 개발 환경 설정 가이드

## ⚡ 빠른 시작 (권장)

협업 개발자라면 이 방법으로 5분 안에 시작하세요!

```bash
# 1. PostgreSQL 데이터베이스 생성
psql -U postgres -c "CREATE DATABASE recipevoice"
psql -U postgres -c "CREATE USER recipevoice WITH PASSWORD 'recipevoice';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice;"

# 2. SQL 덤프 파일로 전체 데이터 복원 (있는 경우)
# psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup.sql

# 3. 마이그레이션 실행
psql -U recipevoice -d recipevoice -f backend/migrations/001_create_cleaned_recipes.sql
psql -U recipevoice -d recipevoice -f backend/migrations/002_create_sessions.sql
psql -U recipevoice -d recipevoice -f backend/migrations/004_add_raw_data_column.sql
psql -U recipevoice -d recipevoice -f backend/migrations/005_grant_permissions.sql

# 3. Backend 의존성 설치 및 실행
cd backend
npm install
npm run dev

# 4. Frontend 의존성 설치 및 실행 (새 터미널)
cd frontend2
npm install
npm run dev
```

**완료!** http://localhost:5173 에서 바로 사용 가능합니다.

---

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
cd ../frontend2
npm install
```

## 3. PostgreSQL 데이터베이스 설정

### ⭐ 방법 1: SQL 덤프로 즉시 복원 (추천)

이 방법을 사용하면 **Planning 완료된 102개 레시피**를 즉시 사용할 수 있습니다.

```bash
# 1. 데이터베이스 생성
psql -U postgres

postgres=# CREATE DATABASE recipevoice;
postgres=# CREATE USER recipevoice WITH PASSWORD 'recipevoice';
postgres=# GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice;
postgres=# \q

# 2. SQL 덤프 파일로 전체 복원 (스키마 + 데이터, 있는 경우)
# psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup.sql

# 3. 마이그레이션 실행
cd backend
psql -U recipevoice -d recipevoice -f migrations/001_create_cleaned_recipes.sql
psql -U recipevoice -d recipevoice -f migrations/002_create_sessions.sql
psql -U recipevoice -d recipevoice -f migrations/004_add_raw_data_column.sql
psql -U recipevoice -d recipevoice -f migrations/005_grant_permissions.sql

# 4. 복원 확인
psql -U recipevoice -d recipevoice

recipevoice=# SELECT COUNT(*) FROM recipes;
 count
-------
   102
(1 row)

recipevoice=# SELECT COUNT(*) FROM cleaned_recipes;
 count
-------
   102
(1 row)

recipevoice=# \q
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
CREATE DATABASE recipevoice;
CREATE USER recipevoice WITH PASSWORD 'recipevoice';
GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice;

# 연결 확인
\c recipevoice
\q
```

#### 3-2. 스키마 생성

```bash
# backend 디렉토리에서 실행
cd backend
psql -U recipevoice -d recipevoice -f schema.sql

# 마이그레이션 실행
psql -U recipevoice -d recipevoice -f migrations/001_create_cleaned_recipes.sql
psql -U recipevoice -d recipevoice -f migrations/002_create_sessions.sql
psql -U recipevoice -d recipevoice -f migrations/004_add_raw_data_column.sql
psql -U recipevoice -d recipevoice -f migrations/005_grant_permissions.sql
```

#### 3-3. 원본 레시피 Import + Planning 실행

**⚠️ 주의: 이 과정은 약 50분 소요됩니다!**

```bash
cd backend

# 1. 원본 레시피 102개 Import (raw_data 포함)
npm run import

# 2. Planning 실행 (gpt-5-nano로 스크립트 생성)
npm run clean:all
```

---

## 3-4. 데이터베이스 덤프 생성 (팀장/공유자용)

팀원들과 데이터베이스를 공유하려면 덤프 파일을 생성하세요.

### ✅ SQL 형식 (추천 - Git에 포함 가능)

```bash
# 전체 데이터베이스 덤프 생성
pg_dump -U recipevoice -d recipevoice > db_dumps/recipevoice_backup.sql

# Git에 추가 (선택적 - 파일 크기 고려)
git add db_dumps/recipevoice_backup.sql
git commit -m "Add database dump with cleaned recipes"
git push
```

### 대안: Binary 형식 (파일 크기 작음)

```bash
# Binary 덤프 생성 (압축됨)
pg_dump -U recipevoice -d recipevoice -F c -f db_dumps/recipevoice_backup.dump

# 복원 방법 (팀원):
pg_restore -U recipevoice -d recipevoice -c db_dumps/recipevoice_backup.dump
```

### Planning 결과만 공유 (가벼움)

```bash
# cleaned_recipes + cleaned_steps만 덤프
pg_dump -U recipevoice -d recipevoice \
  -t cleaned_recipes \
  -t cleaned_steps \
  -t recipes \
  -t ingredients \
  -t steps \
  > db_dumps/cleaned_recipes_only.sql

# 팀원 복원:
psql -U recipevoice -d recipevoice -f schema.sql
psql -U recipevoice -d recipevoice < db_dumps/cleaned_recipes_only.sql
```

## 4. 환경 변수 설정

### Backend 설정

`backend/.env` 파일 생성:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=postgresql://recipevoice:recipevoice@localhost:5432/recipevoice

# Server
PORT=3001
NODE_ENV=development

# Optional: MCP Configuration
MCP_ENABLED=false
```

### Frontend 설정

`frontend2/.env` 파일 생성:

```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 5. 데이터베이스 확인

```bash
# PostgreSQL 접속
psql -U recipevoice -d recipevoice

# 테이블 확인
\dt

# 데이터 확인
SELECT COUNT(*) FROM recipes;           -- 원본 레시피 (102개 기대)
SELECT COUNT(*) FROM cleaned_recipes;   -- Planning 완료된 레시피
SELECT COUNT(*) FROM cleaned_steps;     -- 단계별 스크립트

# raw_data 컬럼 확인
SELECT recipe_id, title, raw_data IS NOT NULL as has_raw_data FROM recipes LIMIT 5;

# 접속 종료
\q
```

## 6. Planning 실행 (데이터 복원 안 한 경우)

**주의: 이 과정은 시간이 오래 걸립니다 (102개 레시피 × 30초 = 약 50분, gpt-5-nano 사용)**

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
cd frontend2

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

### 덤프 파일 형식 비교

#### Binary 형식 (.dump)
- **장점**: 파일 크기 작음 (압축됨, 약 30-50% 작음), 빠른 복원 속도, PostgreSQL 버전 호환성 자동 처리
- **단점**: 텍스트 에디터로 확인 불가, Git diff 불가능, `pg_restore` 명령어 필요
- **사용 명령어**: `pg_dump -F c -f filename.dump`

#### SQL 형식 (.sql)
- **장점**: 텍스트 파일로 확인 가능, Git diff 가능 (변경사항 추적), `psql`로 직접 실행 가능, 수동 편집 가능
- **단점**: 파일 크기가 큼 (압축 안됨), 복원 속도 느림, PostgreSQL 버전 호환성 주의 필요
- **사용 명령어**: `pg_dump > filename.sql`

**권장**: Git 공유 목적이라면 SQL 형식 추천 (변경사항 추적 가능)

### 방법 1: 전체 덤프 생성 및 Git 공유 (권장)

#### 옵션 A: pg_dump 사용 (PostgreSQL 클라이언트 도구 필요)

```bash
# 1. SQL 형식 덤프 생성 (raw_data + cleaned_recipes 포함)
pg_dump -U recipevoice -d recipevoice > db_dumps/recipevoice_backup.sql

# 또는 Binary 형식 (파일 크기 작음)
pg_dump -U recipevoice -d recipevoice -F c -f db_dumps/recipevoice_backup.dump

# 2. Git에 커밋
git add db_dumps/recipevoice_backup.*
git commit -m "Update database dump with latest cleaned recipes"
git push
```

**팀원 복원 방법**:
```bash
# SQL 형식
psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup.sql

# Binary 형식
pg_restore -U recipevoice -d recipevoice -c db_dumps/recipevoice_backup.dump
```

#### 옵션 B: Python 스크립트 사용 (pg_dump 없이도 가능)

PostgreSQL 클라이언트 도구(`pg_dump`, `psql`)가 설치되지 않은 경우 Python 스크립트를 사용할 수 있습니다.

```bash
# 1. Poetry 환경에서 덤프 생성
poetry run python backend/scripts/db_dump.py

# 덤프 파일이 db_dumps/ 폴더에 생성됨
# 예: db_dumps/recipevoice_backup_20250123_143022.sql

# 2. Git에 커밋
git add db_dumps/recipevoice_backup_*.sql
git commit -m "Update database dump with latest cleaned recipes"
git push
```

**팀원 복원 방법**:
```bash
# 방법 1: psql 사용 (PostgreSQL 클라이언트 도구 필요)
psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup_*.sql

# 방법 2: Python 스크립트 사용 (psql 없이도 가능)
# poetry run python backend/scripts/db_restore.py db_dumps/recipevoice_backup_*.sql
```

> **참고**: 
> - `pg_dump` 명령어가 없다면 옵션 B를 사용하세요.
> - Python 스크립트는 Poetry 환경에서 `psycopg`를 통해 데이터베이스에 연결합니다.
> - 덤프 파일은 SQL 형식으로 생성되며, 주요 테이블(recipes, cleaned_recipes, cleaned_steps)의 데이터를 포함합니다.

### 방법 2: FAISS Index 파일 공유

```bash
# Index 파일이 이미 구축되어 있다면 Git에 포함
git add rag-server/storage/faiss.index
git add rag-server/storage/metadata.json
git commit -m "Update FAISS index"
git push
```

**팀원 사용 방법**:
```bash
# Git pull 후 바로 사용 가능
git pull origin main
# rag-server/storage/faiss.index 파일이 자동으로 다운로드됨
```

### 방법 3: 클라우드 PostgreSQL 사용 (선택사항)

**Supabase, Railway, Render 등 무료 PostgreSQL 호스팅**

```env
# 모든 팀원이 같은 DB 사용
DATABASE_URL=postgresql://user:password@db.example.com:5432/recipevoice
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
cd ../frontend2 && npm install

# 3. 데이터베이스 마이그레이션 (스키마 변경 시)
psql -U postgres -d yorijori < backend/migrations/001_new_feature.sql

# 4. 개발 서버 실행
npm run dev:v2  # Backend
npm run dev     # Frontend
```

### 코드 리뷰 전:

```bash
# 1. 타입 체크
cd backend && npm run type-check
cd ../frontend2 && npm run type-check

# 2. 빌드 테스트
cd backend && npm run build
cd ../frontend2 && npm run build

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
pg_dump -U postgres -d yorijori > backup_$(date +%Y%m%d).sql

# 데이터베이스 초기화 (주의!)
psql -U postgres -d yorijori -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -U postgres -d yorijori -f backend/schema.sql
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
├── frontend2/
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
DATABASE_URL=postgresql://user:pass@prod-db.com:5432/yorijori
```

## 16. 팀원 온보딩 체크리스트

- [ ] Node.js 18+ 설치
- [ ] PostgreSQL 설치 및 실행
- [ ] 프로젝트 클론
- [ ] Backend 의존성 설치 (`npm install`)
- [ ] Frontend 의존성 설치 (`npm install`)
- [ ] `.env` 파일 생성 (Backend, Frontend)
- [ ] OpenAI API Key 발급 및 설정
- [ ] 데이터베이스 생성 (`CREATE DATABASE yorijori`)
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
