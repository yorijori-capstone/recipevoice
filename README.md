# RecipeVoice

음성으로 레시피를 안내하는 웹 애플리케이션입니다.

## 1. 필수 설치 항목

프로젝트를 실행하기 위해 다음 소프트웨어가 필요합니다.

-   Python (3.11 권장)
-   Poetry (Python 패키지 및 의존성 관리 도구)
-   Node.js 및 npm (프론트엔드 개발 환경)

## 2. 백엔드 설정

### 2.1. 의존성 설치

Poetry를 사용하여 Python 의존성을 설치합니다.

```bash
poetry install
```

### 2.2. 가상환경 활성화

```bash
poetry shell
```

### 2.3. 데이터베이스 마이그레이션

Django 모델을 기반으로 데이터베이스를 설정합니다.

```bash
cd backend
python manage.py migrate
```

### 2.4. 초기 데이터 로드

`all_recipes.ndjson` 파일의 레시피 데이터를 데이터베이스에 로드합니다.

```bash
python manage.py load_recipes ../data/recipes/all_recipes.ndjson
```

### 2.5. 백엔드 서버 실행

Django 개발 서버를 시작합니다.

```bash
python manage.py runserver
```

서버는 `http://127.0.0.1:8000`에서 실행됩니다.

## 3. 프론트엔드 설정

### 3.1. 프론트엔드 디렉토리로 이동

```bash
cd frontend
```

### 3.2. 의존성 설치

npm을 사용하여 프론트엔드 의존성을 설치합니다.

```bash
npm install
```

### 3.3. 프론트엔드 개발 서버 실행

Vite 개발 서버를 시작합니다.

```bash
npm run dev
```

애플리케이션은 `http://localhost:5173`에서 접속할 수 있습니다.

## 4. 사용법

프론트엔드 개발 서버가 실행되면 `http://localhost:5173`으로 접속하여 애플리케이션을 사용할 수 있습니다.
