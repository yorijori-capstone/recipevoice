# RecipeVoice

음성으로 레시피를 안내하는 웹 애플리케이션입니다.

## 1. 필수 설치 항목

프로젝트를 실행하기 위해 다음 소프트웨어가 필요합니다.

-   Python (3.10 이상)
-   Poetry (Python 패키지 및 의존성 관리 도구)
-   Node.js 및 npm (프론트엔드 개발 환경)

## 2. 초기 환경 설정

최초 실행 시 한 번만 수행하면 되는 설정 과정입니다.

### 2.0. OS별 사전 설치 항목

`PyAudio`는 음성 입출력을 위해 시스템 라이브러리 **PortAudio**에 의존합니다.  
운영체제별로 아래 명령어를 먼저 실행한 후, `poetry install`을 진행하세요.

| 운영체제 | 설치 명령어 |
|-----------|--------------|
| **macOS (Apple Silicon 포함)** | `brew install portaudio` |
| **Windows** | `pip install pipwin && pipwin install pyaudio` |
| **Linux (Ubuntu 등)** | `sudo apt install portaudio19-dev` |

> 💡 위 명령어는 **최초 1회만 실행**하면 됩니다.  
> 이미 PortAudio가 설치되어 있다면 생략 가능합니다.

### 2.1. Python 의존성 설치
```bash
# poetry가 설치되어 있지 않다면 먼저 설치해야 합니다.
poetry install
```

### 2.2. Frontend 의존성 설치
```bash
cd frontend
npm install
cd ..
```

### 2.3. 데이터베이스 및 벡터 인덱스 생성

`data/storage/raw_data` 디렉토리에 레시피 원본 JSON 파일들이 준비되어 있어야 합니다.
데이터베이스 스키마 생성, 데이터 삽입, 벡터 인덱스 생성을 위해 아래 스크립트들을 순서대로 실행합니다.

```bash
# 1. DB 스키마 생성
poetry run python data/app/ingest/db_init.py

# 2. DB에 레시피 데이터 삽입
poetry run python data/app/ingest/db_bulk_seed.py

# 3. FAISS 벡터 인덱스 생성
poetry run python data/app/ingest/build_faiss.py

# 4. migration
poetry run python backend/manage.py migrate
```

## 3. 서버 실행

프로젝트를 실행하려면 **3개의 터미널**을 각각 열고 아래의 서버들을 개별적으로 실행해야 합니다.

### 3.1. 터미널 1: Django 백엔드 서버
```bash
# recipevoice 루트 디렉토리에서 실행
poetry run python backend/manage.py runserver
```
> Django 백엔드 서버는 `http://127.0.0.1:8000`에서 실행됩니다.

### 3.2. 터미널 2: LLM 플래닝 서버
```bash
# recipevoice 루트 디렉토리에서 실행
poetry run python -m llm.planning_server.main
```
> LLM 플래닝 서버는 `http://127.0.0.1:8001`에서 실행됩니다.

### 3.3. 터미널 3: 프론트엔드 개발 서버
```bash
# recipevoice 루트 디렉토리에서 실행
cd frontend
npm run dev
```
> 프론트엔드 애플리케이션은 `http://localhost:5173`에서 접속할 수 있습니다.

## 4. 사용법

모든 서버가 실행되면 웹 브라우저에서 `http://localhost:5173`으로 접속하여 애플리케이션을 사용할 수 있습니다.