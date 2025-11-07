# 0. Node 버전 맞추기 (.nvmrc 기반)
nvm use

# 1. install dependencies
cd recipevoice/rag/RecipeRAG
npm install

# 2. run backend (FastAPI)
PYTHONPATH=. poetry run python dbserver/main.py --reload

# 3. run Express MCP server
npx tsx src/index.ts