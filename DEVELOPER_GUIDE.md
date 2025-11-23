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
- **OpenAI API Key** (필수, `gpt-4o-realtime-preview` 접근 권한 필요)
- **Git**

---

## 2. 빠른 시작 (Quick Start)

이미 환경이 구성된 개발자를 위한 5분 요약 가이드입니다.

### 1) 데이터베이스 복원
```bash
# DB 생성
psql -U postgres -c "CREATE DATABASE recipevoice"
psql -U postgres -c "CREATE USER recipevoice WITH PASSWORD 'recipevoice'"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE recipevoice TO recipevoice"

# 덤프 복원 (SQL 형식 추천)
psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup.sql
```

### 2) 환경 변수 설정
`backend/.env`:
```env
OPENAI_API_KEY=sk-your-key
DATABASE_URL=postgresql://recipevoice:recipevoice@localhost:5432/recipevoice
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
git clone <repository-url>
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
# SQL 형식 복원
psql -U recipevoice -d recipevoice < db_dumps/recipevoice_backup.sql
```

**방법 B: 처음부터 구축**
덤프 파일이 없는 경우, 마이그레이션과 Planning을 직접 실행해야 합니다 (약 50분 소요).
```bash
# 1. 스키마 생성
cd backend
psql -U recipevoice -d recipevoice -f schema.sql

# 2. 마이그레이션 실행
psql -U recipevoice -d recipevoice -f migrations/001_create_cleaned_recipes.sql
psql -U recipevoice -d recipevoice -f migrations/002_create_sessions.sql
psql -U recipevoice -d recipevoice -f migrations/004_add_raw_data_column.sql
psql -U recipevoice -d recipevoice -f migrations/005_grant_permissions.sql

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
2. **브랜치 생성**: `git checkout -b feat/new-feature`
3. **개발 서버 실행**: `npm run dev` (Backend), `npm run dev` (Frontend)
4. **테스트**: 기능 구현 후 로컬 테스트
5. **커밋 & 푸시**: `git push origin feat/new-feature`
6. **PR 생성**: GitHub에서 Pull Request 생성

### 코드 스타일
- **Frontend**: React Functional Components, Hooks, TypeScript
- **Backend**: Express, TypeScript, Service Layer Pattern
- **Commits**: Conventional Commits 권장 (e.g., `feat:`, `fix:`, `docs:`)

---

## 5. 데이터베이스 관리

### 덤프 생성 (공유용)
팀원들과 DB를 공유할 때 사용합니다.
```bash
# SQL 형식 (Git 공유용)
pg_dump -U recipevoice -d recipevoice > db_dumps/recipevoice_backup.sql
```

### 마이그레이션
스키마 변경 시 SQL 파일을 작성하여 `backend/migrations/`에 추가하고 팀원들에게 공유합니다.

---

## 6. 트러블슈팅

### Q: "Cannot connect to PostgreSQL"
- PostgreSQL 서비스가 실행 중인지 확인하세요.
- `DATABASE_URL` 환경 변수가 올바른지 확인하세요.

### Q: "OpenAI API Error"
- API Key가 유효한지, 잔액이 충분한지 확인하세요.
- `gpt-4o-realtime-preview` 모델 접근 권한이 있는지 확인하세요.

### Q: "WebSocket connection failed"
- Backend 서버가 3001 포트에서 실행 중인지 확인하세요.
- Frontend `.env`의 `VITE_WS_URL`이 올바른지 확인하세요.

### Q: "cleaned_recipes table is empty"
- DB 복원이 제대로 되지 않았거나, Planning이 실행되지 않았습니다.
- `npm run clean:all`을 실행하거나 덤프를 다시 복원하세요.
