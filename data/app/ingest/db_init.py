# app/db_init.py
import os, sqlite3, textwrap, yaml

# 1. 현재 파일 기준으로 프로젝트 루트 절대경로 계산
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))

# 2. config.yaml 절대경로 지정
CFG_PATH = os.path.join(ROOT, "config.yaml")

# 3. 설정 로드
with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

# 4. DB 경로 계산
sqlite_path = os.path.join(ROOT, CFG["paths"]["sqlite_path"])
os.makedirs(os.path.dirname(sqlite_path), exist_ok=True)

# 5. DDL 정의
DDL = """
PRAGMA foreign_keys = ON;

-- ==============================
-- recipe: 기본 정보
-- ==============================
CREATE TABLE IF NOT EXISTS recipe (
  recipe_id       TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  source          TEXT NOT NULL,
  external_id     TEXT,            -- 원천의 고유 ID (없을 수 있음)
  author          TEXT,
  servings        TEXT,
  total_time      TEXT,
  difficulty      TEXT,
  created_at      TEXT DEFAULT (datetime('now','localtime')),
  updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- 외부ID가 있는 경우에만 (source, external_id) 유니크 보장
CREATE UNIQUE INDEX IF NOT EXISTS ux_recipe_source_ext
ON recipe(source, external_id)
WHERE external_id IS NOT NULL;

-- ==============================
-- updated_at 자동 갱신 트리거 (INSERT/UPDATE 시 점검)
-- ==============================
CREATE TRIGGER IF NOT EXISTS recipe_set_updated_at
AFTER UPDATE ON recipe
BEGIN
  UPDATE recipe SET updated_at = datetime('now','localtime') WHERE recipe_id = NEW.recipe_id;
END;

-- ==============================
-- recipe_doc: 원문 JSON 저장
-- ==============================
CREATE TABLE IF NOT EXISTS recipe_doc (
  recipe_id   TEXT PRIMARY KEY REFERENCES recipe(recipe_id) ON DELETE CASCADE,
  source_url  TEXT,
  raw_json    TEXT
);

-- ==============================
-- step: 조리 단계
-- ==============================
CREATE TABLE IF NOT EXISTS step (
  step_id        TEXT PRIMARY KEY,
  recipe_id      TEXT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
  step_no        INTEGER,
  text           TEXT NOT NULL,
  time_hint_sec  INTEGER,
  tools_json     TEXT,
  warnings_json  TEXT,
  meta_json      TEXT
);

CREATE INDEX IF NOT EXISTS idx_step_recipe ON step(recipe_id, step_no);

-- ==============================
-- chunk: 세부 분석 단위 (레시피 문장 등)
-- ==============================
CREATE TABLE IF NOT EXISTS chunk (
  chunk_id   TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  step_id    TEXT REFERENCES step(step_id),
  step_no    INTEGER,          -- UNIQUE(recipe_id, step_no) 보장을 위해 추가
  section    TEXT,             -- "step" | "ingredients" | "tips" 등
  text       TEXT NOT NULL,
  meta_json  TEXT,
  FOREIGN KEY(recipe_id) REFERENCES recipe(recipe_id) ON DELETE CASCADE,
  UNIQUE(recipe_id, step_no)    -- 같은 레시피에서 같은 단계 중복 금지
);

CREATE INDEX IF NOT EXISTS idx_chunk_recipe ON chunk(recipe_id);

-- ==============================
-- FTS5 (스파스 검색용)
-- ==============================
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
  text, content='chunk', content_rowid='rowid', tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunk_ai AFTER INSERT ON chunk BEGIN
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunk_ad AFTER DELETE ON chunk BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunk_au AFTER UPDATE ON chunk BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;

-- ==============================
-- chunk_embedding_meta: FAISS 매핑 메타
-- ==============================
CREATE TABLE IF NOT EXISTS chunk_embedding_meta (
  chunk_id        TEXT PRIMARY KEY REFERENCES chunk(chunk_id) ON DELETE CASCADE,
  model_name      TEXT NOT NULL,
  dim             INTEGER NOT NULL,
  created_at      TEXT DEFAULT (datetime('now','localtime')),
  faiss_vector_id INTEGER NOT NULL,
  UNIQUE(faiss_vector_id)   -- 1:1 매핑 보장
);

-- ==============================
-- store_recommendations: 재료 기반 매장 추천
-- ==============================
CREATE TABLE IF NOT EXISTS store_recommendations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id     TEXT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
  ingredient    TEXT NOT NULL,
  store_name    TEXT NOT NULL,
  address       TEXT,
  lat           REAL,
  lon           REAL,
  search_keyword TEXT,
  search_date   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_store_recommendations_recipe 
ON store_recommendations(recipe_id, ingredient);
"""

# 6. DB 초기화
with sqlite3.connect(sqlite_path) as conn:
    conn.executescript(DDL)
    conn.commit()
    print(f"SQLite schema initialized at {sqlite_path}")