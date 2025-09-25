# 🚀 실행 방법

## 1. 프로젝트 클론

```bash
git clone https://github.com/yorijori-capstone/recipevoice.git
cd recipevoice
```

## 2. Poetry 설치

Poetry가 설치되어 있지 않다면 먼저 설치합니다.

### macOS / Linux:
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

### Windows (PowerShell):
```bash
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
```

### 설치 확인:
```bash
poetry --version
```
## 3. 프로젝트 의존성 설치

프로젝트 루트에서 Poetry 환경을 생성하고 패키지를 설치합니다.

### 프로젝트 가상환경 생성 및 활성화
```bash
poetry install
```

### 가상환경 진입 (선택적)
```bash
poetry shell
```

⚠️ 주의: Poetry는 자동으로 Python 버전을 감지하지만, 필요 시 pyproject.toml에 지정된 Python 버전 확인
```bash
poetry env use 3.11
```

## 4. 환경 변수 설정

.env.example 파일을 복사하여 .env로 생성 후, 필요한 환경 변수들을 입력합니다.
```bash
cp .env.example .env
```

### 편집
```bash
nano .env
```

환경 변수 예시:
```plain text
DATABASE_URL=postgresql://username:password@localhost:5432/recipevoice
OPENAI_API_KEY=sk-xxxxxx
...
```

## 5. 데이터베이스 초기화

Django 마이그레이션 수행:
```bash
poetry run python backend/manage.py migrate
```

필요한 경우 관리자 계정 생성:
```bash
poetry run python backend/manage.py createsuperuser
```

## 6. 개발 서버 실행
### Django 서버 실행
```bash
poetry run python backend/manage.py runserver
```

### 프론트엔드 (React) 서버 실행
```bash
cd frontend
npm install
npm start
```

## 7. MCP 서버 / RAG / LLM 연동

MCP, RAG, LLM은 각자의 설정 파일 또는 환경 변수로 연결

테스트용 mock 데이터로 먼저 실행 가능

예:

### backend/app/tasks.py 등에서 MCP API 호출 테스트
```bash
poetry run python backend/app/tasks.py
```

## 8. 테스트
```bash
poetry run pytest
```

## ⚡ Tip

팀원은 항상 develop 브랜치에서 시작하고, 기능별 브랜치를 생성 후 PR

가상환경 문제 발생 시:

```bash
poetry env info
poetry env remove <환경 이름>
poetry install
```