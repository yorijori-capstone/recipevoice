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
# 2. DB 연결 및 chunk 로드
# -------------------------
conn = sqlite3.connect(SQLITE_PATH)
conn.row_factory = sqlite3.Row

rows = conn.execute("SELECT chunk_id, text FROM chunk ORDER BY rowid").fetchall()
texts = [r["text"] for r in rows]
chunk_ids = [r["chunk_id"] for r in rows]
print(f"chunks: {len(texts)}")

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
# -------------------------
# 테이블 구조 예시:
# chunk_embedding_meta(chunk_id TEXT, model_name TEXT, dim INTEGER, faiss_vector_id INTEGER)
conn.execute("DELETE FROM chunk_embedding_meta")

for i, cid in enumerate(chunk_ids):
    conn.execute(
        """
        INSERT INTO chunk_embedding_meta
        (chunk_id, model_name, dim, faiss_vector_id)
        VALUES (?, ?, ?, ?)
        """,
        (cid, MODEL_NAME, DIM, i)
    )

conn.commit()
conn.close()
print("chunk_embedding_meta written")
