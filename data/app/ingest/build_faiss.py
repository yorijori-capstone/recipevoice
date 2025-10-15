import os, sqlite3, yaml, faiss, shutil, tempfile, numpy as np
from pathlib import Path

# -------------------------
# 0. 경로 계산 (루트 기준)
# -------------------------
ROOT = Path(__file__).resolve().parents[3]          # recipevoice/ (최상위)
CFG_PATH = ROOT / "config.yaml"

with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

SQLITE_PATH = (ROOT / CFG["paths"]["sqlite_path"]).resolve()
FAISS_PATH  = (ROOT / CFG["paths"]["faiss_index_path"]).resolve()
MODEL_NAME  = CFG["embedding"]["model"]
DIM         = int(CFG["embedding"]["dim"])

os.makedirs(os.path.dirname(FAISS_PATH), exist_ok=True)

# -------------------------
# 1. 임베더 import 및 초기화
# -------------------------
# 절대경로 임포트
from data.app.emb_local import LocalEmbedder

embedder = LocalEmbedder(MODEL_NAME)

# -------------------------
# 2. DB 연결 및 스텝 텍스트 로드
#    - step 테이블 기준으로 텍스트 임베딩/색인
# -------------------------
conn = sqlite3.connect(SQLITE_PATH)
conn.row_factory = sqlite3.Row

# 존재 컬럼 확인 (스키마 안전성 확보)
def table_has_columns(cur, table, needed):
    cur.execute(f"PRAGMA table_info({table})")
    cols = {r[1] for r in cur.fetchall()}
    return all(c in cols for c in needed), cols

cur = conn.cursor()
has_step, step_cols = table_has_columns(cur, "step", {"recipe_id", "step_no", "text"})
if not has_step:
    raise RuntimeError(f"Required columns not found in step table. Found: {step_cols}")

rows = conn.execute(
    "SELECT recipe_id, step_no, text FROM step ORDER BY recipe_id, step_no"
).fetchall()
texts = [r["text"] for r in rows]
meta = [(str(r["recipe_id"]), int(r["step_no"])) for r in rows]
chunk_ids = [f"{rid}:{sno}" for rid, sno in meta]
print(f"steps indexed: {len(texts)}")

# -------------------------
# 3. 임베딩 & FAISS 인덱스
# -------------------------
embs = embedder.encode(texts)  # shape (N, DIM)
embs = np.array(embs).astype("float32")

index = faiss.IndexFlatIP(DIM)     # inner product index
index.add(embs)


tmp_dir = tempfile.gettempdir()
tmp_path = Path(tmp_dir) / "chunks.index"
try:
    # 1) 임시 위치에 기록 (영문 경로)
    faiss.write_index(index, str(tmp_path))
    print(f"[OK] faiss index temporarily written to: {tmp_path}")

    # 2) 최종 저장소 디렉터리 보장
    FAISS_PATH = Path(FAISS_PATH)  # 혹시 문자열이면 Path로 보정
    FAISS_PATH.parent.mkdir(parents=True, exist_ok=True)

    # 3) 기존 파일이 있으면 교체
    shutil.copy2(tmp_path, FAISS_PATH)
    print(f"[OK] faiss index copied to: {FAISS_PATH}")

finally:
    # 4) 임시 파일 정리 (실패해도 무시)
    try:
        if tmp_path.exists():
            tmp_path.unlink()
    except Exception:
        pass

print("faiss ntotal:", index.ntotal)



# -------------------------
# 4. 메타 테이블 갱신
#    - vector_idx, text, recipe_id, step_no 저장
# -------------------------
conn.execute(
    """
    CREATE TABLE IF NOT EXISTS chunk_embedding_meta (
        chunk_id TEXT,
        text TEXT,
        recipe_id TEXT,
        step_no INTEGER,
        model_name TEXT,
        dim INTEGER,
        vector_idx INTEGER
    )
    """
)

# 기존 테이블이 있을 경우, 필요한 컬럼이 없으면 추가 (SQLite는 IF NOT EXISTS 절을 컬럼에 지원하지 않음)
cur = conn.cursor()
cur.execute("PRAGMA table_info(chunk_embedding_meta)")
existing_cols = {r[1] for r in cur.fetchall()}
required_cols = [
    ("chunk_id", "TEXT"),
    ("text", "TEXT"),
    ("recipe_id", "TEXT"),
    ("step_no", "INTEGER"),
    ("model_name", "TEXT"),
    ("dim", "INTEGER"),
    ("vector_idx", "INTEGER"),
    # for backward compatibility with previous schema
    ("faiss_vector_id", "INTEGER"),
]
for col_name, col_type in required_cols:
    if col_name not in existing_cols:
        conn.execute(f"ALTER TABLE chunk_embedding_meta ADD COLUMN {col_name} {col_type}")
conn.execute("DELETE FROM chunk_embedding_meta")

for i, (cid, (rid, sno), text) in enumerate(zip(chunk_ids, meta, texts)):
    # Build dynamic column list to satisfy existing NOT NULL constraints
    insert_cols = ["chunk_id", "text", "recipe_id", "step_no", "model_name", "dim", "vector_idx"]
    values = [cid, text, rid, sno, MODEL_NAME, DIM, i]
    if "faiss_vector_id" in existing_cols:
        insert_cols.append("faiss_vector_id")
        values.append(i)

    placeholders = ", ".join(["?"] * len(insert_cols))
    projection = ", ".join(insert_cols)
    conn.execute(
        f"INSERT INTO chunk_embedding_meta ({projection}) VALUES ({placeholders})",
        tuple(values),
    )

conn.commit()
conn.close()
print("chunk_embedding_meta written (vector_idx, text, recipe_id, step_no)")
