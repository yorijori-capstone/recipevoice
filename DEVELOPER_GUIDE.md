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

### 1) 데이터베이스 복원
```bash
# DB 생성
psql -U postgres -c "CREATE DATABASE yorijori"

# 덤프 복원
psql -U postgres -d yorijori < db_dumps/recipevoice_backup_20251123_042152.sql
```

### 2) 환경 변수 설정

**backend/.env** (필수):
```env
OPENAI_API_KEY=sk-your-key

# 데이터베이스 설정
DB_NAME=yorijori
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres

# 서버 포트
PORT=3001
```

**frontend2/.env** (선택 - 없어도 됨):
```env
# 설정하지 않으면 자동으로 현재 hostname:3001 사용
# 외부 서버를 사용할 경우에만 설정
VITE_API_BASE_URL=http://your-server-ip:3001
```

> 💡 **참고**: frontend2는 환경변수가 없으면 `window.location.hostname`을 사용하여 동적으로 API URL을 생성합니다. 로컬 개발 시에는 `.env` 파일이 필요 없습니다.

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

팀 공유용 덤프 파일(`db_dumps/`)을 사용하여 즉시 환경을 구축합니다.
```bash
# DB 생성
psql -U postgres -c "CREATE DATABASE yorijori"

# 덤프 복원
psql -U postgres -d yorijori < db_dumps/recipevoice_backup_20251123_042152.sql
```

**방법 B: 처음부터 구축**

덤프 파일이 없는 경우, 마이그레이션과 Planning을 직접 실행해야 합니다 (약 50분 소요).
```bash
# 1. 스키마 생성
cd backend
psql -U postgres -d yorijori -f scripts/init-db.sql

# 2. 마이그레이션 실행
psql -U postgres -d yorijori -f migrations/001_create_cleaned_recipes.sql
psql -U postgres -d yorijori -f migrations/002_create_sessions.sql
psql -U postgres -d yorijori -f migrations/003_remove_voice_mode.sql
psql -U postgres -d yorijori -f migrations/004_add_raw_data_column.sql
psql -U postgres -d yorijori -f migrations/005_grant_permissions.sql

# 3. 데이터 Import 및 Planning
npm run import      # 원본 데이터 로드
npm run clean:all   # AI Planning 실행
```

### 3-3. npm 스크립트 목록

```bash
# Backend (backend/)
npm run dev        # 개발 서버 실행 (tsx watch)
npm run build      # TypeScript 빌드
npm run start      # 프로덕션 서버 실행
npm run import     # 레시피 데이터 가져오기
npm run clean:all  # 모든 레시피 AI Planning 실행

# Frontend (frontend2/)
npm run dev        # 개발 서버 실행 (Vite)
npm run build      # 프로덕션 빌드
npm run preview    # 빌드 미리보기
```

---

## 4. 개발 워크플로우

### 새로운 기능 개발 시
1. **최신 코드 받기**: `git pull origin develop2`
2. **브랜치 생성**: `git checkout -b 개발자초성-기능명`
3. **개발 서버 실행**: 
   - Backend: `cd backend && npm run dev`
   - Frontend: `cd frontend2 && npm run dev`
4. **테스트**: 기능 구현 후 로컬 테스트
5. **커밋 & 푸시**: `git push origin 개발자초성-기능명`
6. **PR 생성**: GitHub에서 `develop2`로 Pull Request 생성

### 코드 스타일
- **Frontend**: React Functional Components, Hooks, TypeScript
- **Backend**: Express, TypeScript, Service Layer Pattern
- **Commits**: Conventional Commits 권장 (e.g., `feat:`, `fix:`, `refactor:`)

### 브랜치 전략
- `main`: 안정 버전
- `develop2`: 개발 통합 브랜치
- `개발자초성-기능명`: 개인 작업 브랜치 (예: `sh-debug3`, `js-integration2`)

---

## 5. 데이터베이스 관리

### 덤프 생성 (공유용)
팀원들과 DB를 공유할 때 사용합니다.
```bash
# SQL 형식 (Git 공유용)
pg_dump -U postgres -d yorijori > db_dumps/yorijori_backup_$(date +%Y%m%d).sql
```

### 현재 덤프 파일
- `db_dumps/recipevoice_backup_20251123_042152.sql` - 2024년 11월 23일 백업

### 마이그레이션 파일 목록
```
backend/migrations/
├── 001_create_cleaned_recipes.sql  # cleaned_recipes 테이블
├── 002_create_sessions.sql         # sessions 테이블
├── 003_remove_voice_mode.sql       # voice_mode 컬럼 제거
├── 004_add_raw_data_column.sql     # raw_data JSONB 컬럼
└── 005_grant_permissions.sql       # 권한 설정
```

스키마 변경 시 SQL 파일을 작성하여 `backend/migrations/`에 추가하고 팀원들에게 공유합니다.

---

## 6. 트러블슈팅

### Q: "Cannot connect to PostgreSQL"
- PostgreSQL 서비스가 실행 중인지 확인하세요.
- `.env` 파일의 `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`가 올바른지 확인하세요.
- 기본값: `DB_NAME=yorijori`, `DB_USER=postgres`, `DB_PASSWORD=postgres`

### Q: "column 'raw_data' of relation 'recipes' does not exist"
**가장 흔한 오류!** 데이터베이스에 `raw_data` 컬럼이 없을 때 발생합니다.

**해결 방법:**
```bash
# raw_data 컬럼 추가
psql -U postgres -d yorijori -c "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS raw_data JSONB;"
psql -U postgres -d yorijori -c "CREATE INDEX IF NOT EXISTS idx_recipes_raw_data ON recipes USING GIN (raw_data);"

# 백엔드 서버 재시작
```

### Q: "OpenAI API Error"
- API Key가 유효한지, 잔액이 충분한지 확인하세요.
- `gpt-realtime` 모델 접근 권한이 있는지 확인하세요.

### Q: "WebSocket connection failed"
- Backend 서버가 3001 포트에서 실행 중인지 확인하세요.
- 방화벽이 3001 포트를 차단하고 있지 않은지 확인하세요.

### Q: "cleaned_recipes table is empty"
- DB 복원이 제대로 되지 않았거나, Planning이 실행되지 않았습니다.
- `npm run clean:all`을 실행하거나 덤프를 다시 복원하세요.

### Q: "MCP Tool Calling disabled" (Windows)
- Windows에서 MCP 서버 초기화 실패 시 발생합니다.
- 최신 코드를 pull하여 Windows 호환성 패치가 적용되었는지 확인하세요.

### Q: 모바일/다른 기기에서 접속이 안됨
- Frontend가 `--host` 옵션으로 실행되고 있는지 확인: `npm run dev`는 기본으로 `--host` 포함
- Backend가 모든 인터페이스에서 수신하는지 확인
- 같은 네트워크에 있는지 확인
- PC의 IP 주소로 접속: `http://PC_IP:5173`
