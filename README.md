# 🚀 실행 방법
## 1. 프로젝트 클론
```bash
git clone https://github.com/yorijori-capstone/recipevoice.git
cd recipevoice
```

## 2. Poetry 설치

Poetry가 설치되어 있지 않다면 먼저 설치합니다.

#### macOS / Linux
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

#### Windows (PowerShell)
```bash
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
```

#### 설치 확인
```bash
poetry --version
```

## 3. 프로젝트 의존성 설치 및 가상환경 생성
```bash
poetry install
```

⚠️ Python 버전을 직접 지정하고 싶다면:
```bash
poetry env use 3.11
```

## 4. 가상환경 진입

Poetry 2.0 이상에서는 기본적으로 poetry shell이 빠져있으므로, 플러그인을 설치해야 합니다.

#### 플러그인 설치
```bash
poetry self add poetry-plugin-shell
```

#### 가상환경 진입
```bash
poetry shell
```

가상환경 정보를 확인하려면:
```bash
poetry env info
```