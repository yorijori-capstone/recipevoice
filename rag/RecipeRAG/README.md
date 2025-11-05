# UnityRAG Suite (FastAPI Backend + MCP Server)

This bundle contains two components that work together:

## 1) `backend/` — FastAPI Unity Docs RAG
**Purpose:** Local API that serves search over *offline Unity documentation* (no cloud calls).  
**Endpoints:** `/search`, `/versions`, `/set_index_dir`, `/health`.  
**Skip re-embedding:** Point to any **existing index** at runtime via `POST /set_index_dir`.

**Run (Windows):**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py serve
# then open http://127.0.0.1:8000/health
```

**Run (macOS/Linux):**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py serve
# then open http://127.0.0.1:8000/health
```

> Drop your prebuilt index files into `backend/index/`: `chunks.sqlite`, `vec.index`, `vec_meta.json`.

## 2) `UnityRAG/` — MCP server (TypeScript, mcp-framework)
**Purpose:** Exposes tools and curated resources to AI assistants via **MCP**.  
**Talks to:** the FastAPI backend at `UNITY_RAG_BASE_URL`.

**Tools:**
- `unity_docs_search(q, version?, top_k=8)`
- `unity_set_index_dir(index_dir)`
- `unity_list_versions()`
- `unity_detect_project_version(project_path)`
- `unity_snippets_get_all()`
- `unity_snippets_by_tag(tag)`
- `unity_snippets_index()`

**Run:**
```bash
cd UnityRAG
npm install
npm run build
npx UnityRAG
```

### Curated snippets (drop-in later)
Put your research outputs at:
```
UnityRAG/snippets/unity_snippets.json
UnityRAG/snippets/INDEX.md
```
Or set custom paths in `UnityRAG/.env`:
```
UNITY_SNIPPETS_PATH=./snippets/unity_snippets.json
UNITY_SNIPPETS_INDEX_PATH=./snippets/INDEX.md
```

### Version policy for snippets
- **Primary:** Unity **6 LTS** + current **Update** (6000.x).
- **Legacy:** add `"2022.3 (legacy)"` only when relevant.
- Support **version-gating** strings like `"6000.2+"`, `"6000.0–6000.2"`.

### Client configuration
Use the ready files in `UnityRAG/configs/` for Warp, VS Code Copilot, Cursor, Claude Desktop, and Raycast.

---

## Assistant instructions
See `assistant_instructions.md` for a ready-to-paste template that prompts AI tools to:
- **1) Detect project version**
- **2) Look up curated snippets first**
- **3) Fall back to docs search**
- **4) Honor version tags & performance/complexity notes**
