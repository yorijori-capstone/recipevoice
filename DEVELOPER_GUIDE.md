# 🧑‍💻 RecipeVoice Developer Guide

이 문서는 RecipeVoice 프로젝트의 개발자를 위한 가이드입니다. 개발 환경 설정, 실행 방법, 트러블슈팅 등 팀원들이 알아야 할 모든 기술적인 내용을 담고 있습니다.

---

## 📋 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [빠른 시작 (Quick Start)](#2-빠른-시작-quick-start)
3. [상세 설정 가이드](#3-상세-설정-가이드)
4. [개발 워크플로우](#4-개발-워크플로우)
5. [데이터베이스 관리](#5-데이터베이스-관리)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 사전 요구사항

- **Node.js 18+** (필수)
- **PostgreSQL 14+** (필수)
- **OpenAI API Key** (필수, `gpt-realtime` 접근 권한 필요)
- **Git**

---

## 2. 빠른 시작 (Quick Start)

이미 환경이 구성된 개발자를 위한 5분 요약 가이드입니다.

### 1) 데이터베이스 복원 (실제 실행 순서)
```bash
# 1. PostgreSQL 계정/DB 초기화
psql -U postgres -c "DROP DATABASE IF EXISTS yorijoridb;"
psql -U postgres <<'EOF'
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'insight') THEN
        CREATE ROLE insight LOGIN PASSWORD 'insight';
    END IF;
END
$$;
EOF

psql -U postgres -c "CREATE DATABASE yorijoridb OWNER insight"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE yorijoridb TO insight"

# 2. 마이그레이션 실행 (테이블/컬럼 생성)
psql -U insight -d yorijoridb -f backend/migrations/001_create_cleaned_recipes.sql
psql -U insight -d yorijoridb -f backend/migrations/002_create_sessions.sql
psql -U insight -d yorijoridb -f backend/migrations/004_add_raw_data_column.sql
psql -U insight -d yorijoridb -f backend/migrations/005_grant_permissions.sql

# 3. 팀원이 제공한 덤프 복원
#    예: db_dumps/yorijoridb_backup_20251129_180604.sql
psql -v ON_ERROR_STOP=1 -U insight -d yorijoridb < db_dumps/yorijoridb_backup_20251129_180604.sql
```
로컬에 빈 `yorijoridb` DB가 있다면 위 순서대로 DROP → CREATE → MIGRATION → RESTORE를 실행하고, 덤프가 JSONB 기반이라 오류가 반복되면 `backend/scripts/db_dump.py`로 새 파일을 생성하거나 팀원에게 다시 요청하세요. `yorijoridb_backup_*.sql` 또는 기존 `recipevoice_backup_*.sql` 파일명을 확인한 뒤에 `psql -U insight -d yorijoridb < db_dumps/<파일명>`으로 적용하면 됩니다.

### 2) 환경 변수 설정
`backend/.env`:
```env
OPENAI_API_KEY=sk-your-key
DB_NAME=yorijoridb
DB_HOST=localhost
DB_PORT=5432
DB_USER=insight
DB_PASSWORD=insight
PORT=3001
```

`frontend2/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 3) 서버 실행
```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
cd frontend2 && npm install && npm run dev
```

접속: http://localhost:5173

---

## 3. 상세 설정 가이드

### 3-1. 프로젝트 클론 및 의존성 설치
```bash
git clone https://github.com/yorijori-capstone/recipevoice.git
cd recipevoice

# Backend
cd backend
npm install

# Frontend
cd ../frontend2
npm install
```

### 3-2. 데이터베이스 설정 (상세)

**방법 A: 덤프 파일로 복원 (권장)**
팀 공유용 덤프 파일(`db_dumps/`)을 사용하여 즉시 환경을 구축합니다. 복원 전에 반드시 migrations (`001`/`002`/`004`/`005`)을 실행해서 스키마를 준비하세요.
```bash
# 1. (선택) 기존 schema 삭제 후 초기화
psql -U postgres -c "DROP DATABASE IF EXISTS yorijoridb;"
psql -U postgres -c "CREATE DATABASE yorijoridb OWNER insight"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE yorijoridb TO insight"

# 2. 스키마 생성
psql -U insight -d yorijoridb -f backend/migrations/001_create_cleaned_recipes.sql
psql -U insight -d yorijoridb -f backend/migrations/002_create_sessions.sql
psql -U insight -d yorijoridb -f backend/migrations/004_add_raw_data_column.sql
psql -U insight -d yorijoridb -f backend/migrations/005_grant_permissions.sql

# 3. 공유 덤프 복원 (예: db_dumps/yorijoridb_backup_20251129_180604.sql)
psql -v ON_ERROR_STOP=1 -U insight -d yorijoridb < db_dumps/yorijoridb_backup_20251129_180604.sql
```

**방법 B: 처음부터 구축**
덤프 파일이 없다면 `scripts/init-db.sql`로 `recipes/ingredients/steps` 스키마를 만들고, 마이그레이션, 인포트, Planning을 차례로 실행합니다.
```bash
# 1. 스키마 초기화
cd backend
psql -U insight -d yorijoridb -f scripts/init-db.sql

# 2. 마이그레이션 실행
psql -U insight -d yorijoridb -f migrations/001_create_cleaned_recipes.sql
psql -U insight -d yorijoridb -f migrations/002_create_sessions.sql
psql -U insight -d yorijoridb -f migrations/004_add_raw_data_column.sql
psql -U insight -d yorijoridb -f migrations/005_grant_permissions.sql

# 3. 데이터 Import 및 Planning
npm run import      # 원본 데이터 로드
npm run clean:all   # AI Planning 실행 (gpt-5-nano)
```

### 3-3. RAG 검색 설정 (FAISS)
RAG 검색을 위해 FAISS 인덱스가 필요합니다.
```bash
# Git pull 시 자동으로 `data/storage/`에 인덱스 파일이 동기화됩니다.
# 만약 없다면:
cd backend
npm run build:index  # (스크립트가 설정된 경우) 또는 관련 Python 스크립트 실행
```

---

## 4. 개발 워크플로우

### 새로운 기능 개발 시
1. **최신 코드 받기**: `git pull origin main`
2. **브랜치 생성**: `git checkout -b 개발자초성-기능명`
3. **개발 서버 실행**: `npm run dev` (Backend), `npm run dev` (Frontend)
4. **테스트**: 기능 구현 후 로컬 테스트
5. **커밋 & 푸시**: `git push origin 개발자초성-기능명`
6. **PR 생성**: GitHub에서 Pull Request 생성

### 코드 스타일
- **Frontend**: React Functional Components, Hooks, TypeScript
- **Backend**: Express, TypeScript, Service Layer Pattern
- **Commits**: Conventional Commits 권장 (e.g., `[feat]`, `[refactor]`, `[file]`)

---

## 5. 데이터베이스 관리

### 덤프 생성 (공유용)
팀원들과 DB를 공유할 때 사용합니다.
```bash
# SQL 형식 (Git 공유용)
pg_dump -U insight -d yorijoridb > db_dumps/yorijoridb_backup_$(date +%Y%m%d_%H%M%S).sql
```
`backend/scripts/db_dump.py` generates compatible SQL (it now formats `tips` as `ARRAY[]::text[]`). If you're restoring from an existing `db_dumps/recipevoice_backup_*.sql` that was created before this fix, regenerate it with the script before importing — the older files embed `::jsonb` values for `tips` and will fail against the current schema.

### 팀원이 제공한 덤프 받기
다른 팀원이 새 덤프를 생성해서 전달해 준 경우, 파일을 `db_dumps/`로 복사한 뒤 파일명을 정확히 확인하세요. 로컬 DB에 데이터가 없다면 먼저 `DROP DATABASE IF EXISTS yorijoridb;` → `CREATE DATABASE ...` → `GRANT ...` 순서로 스키마를 초기화한 뒤 덤프를 `psql -U insight -d yorijoridb -f db_dumps/<파일명>`으로 불러오세요. 복원 중 오류가 발생하면 해당 덤프를 다시 받아서 시도해야 합니다.

### 마이그레이션
스키마 변경 시 SQL 파일을 작성하여 `backend/migrations/`에 추가하고 팀원들에게 공유합니다.

---

## 6. 트러블슈팅

### Q: "Cannot connect to PostgreSQL"
- PostgreSQL 서비스가 실행 중인지 확인하세요.
- `.env` 파일의 `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`가 올바른지 확인하세요.
- 기본값: `DB_NAME=yorijoridb`, `DB_USER=insight`, `DB_PASSWORD=insight`

### Q: "column 'raw_data' of relation 'recipes' does not exist"
**가장 흔한 오류!** 데이터베이스에 `raw_data` 컬럼이 없을 때 발생합니다.

**해결 방법:**
```bash
# 1. .env 파일에서 실제 사용 중인 데이터베이스 이름 확인
grep DB_NAME backend/.env
# 출력 예: DB_NAME=yorijoridb

# 2. 해당 데이터베이스에 raw_data 컬럼 추가
psql -U insight -d yorijoridb -c "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS raw_data JSONB;"
psql -U insight -d yorijoridb -c "CREATE INDEX IF NOT EXISTS idx_recipes_raw_data ON recipes USING GIN (raw_data);"

# 3. 백엔드 서버 재시작
```

**주의:** 시스템에 여러 데이터베이스가 있을 수 있습니다 (`recipevoice`, `recipe-db`, `recipe_db`, `yorijori` 등). 반드시 `.env` 파일에 설정된 데이터베이스에 컬럼을 추가해야 합니다!

### Q: "OpenAI API Error"
- API Key가 유효한지, 잔액이 충분한지 확인하세요.
- `gpt-realtime` 모델 접근 권한이 있는지 확인하세요.

### Q: "WebSocket connection failed"
- Backend 서버가 3001 포트에서 실행 중인지 확인하세요.
- Frontend `.env`의 `VITE_WS_URL`이 올바른지 확인하세요.

### Q: "cleaned_recipes table is empty"
- DB 복원이 제대로 되지 않았거나, Planning이 실행되지 않았습니다.
- `npm run clean:all`을 실행하거나 덤프를 다시 복원하세요.
