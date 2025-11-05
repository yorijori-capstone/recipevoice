"""Build FAISS index from PostgreSQL chunk data."""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import faiss
import numpy as np
import psycopg
import yaml

from data.app.emb_local import LocalEmbedder

ROOT = Path(__file__).resolve().parents[3]
CFG_PATH = ROOT / "config.yaml"

with CFG_PATH.open("r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

DB_CFG = CFG.get("database")
if not DB_CFG:
    raise RuntimeError("database configuration missing in config.yaml")

FAISS_PATH = (ROOT / CFG["paths"]["faiss_index_path"]).resolve()
FAISS_PATH.parent.mkdir(parents=True, exist_ok=True)

MODEL_NAME = CFG["embedding"]["model"]
DIM = int(CFG["embedding"]["dim"])

embedder = LocalEmbedder(MODEL_NAME)

CONN_ARGS = {
    "dbname": DB_CFG.get("name"),
    "user": DB_CFG.get("user"),
    "password": DB_CFG.get("password"),
    "host": DB_CFG.get("host", "127.0.0.1"),
    "port": DB_CFG.get("port", 5432),
}
CONN_ARGS.update(DB_CFG.get("options") or {})


def fetch_chunks() -> tuple[list[str], list[str]]:
    with psycopg.connect(**CONN_ARGS) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT chunk_id, text FROM chunk ORDER BY chunk_id")
            rows = cur.fetchall()

        chunk_ids = [cid for cid, _ in rows]
        texts = [txt or "" for _, txt in rows]
        return chunk_ids, texts


def write_embedding_meta(chunk_ids: list[str]) -> None:
    with psycopg.connect(**CONN_ARGS) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chunk_embedding_meta")
            for idx, chunk_id in enumerate(chunk_ids):
                cur.execute(
                    """
                    INSERT INTO chunk_embedding_meta (chunk_id, model_name, dim, faiss_vector_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (chunk_id) DO UPDATE SET
                        model_name = EXCLUDED.model_name,
                        dim = EXCLUDED.dim,
                        faiss_vector_id = EXCLUDED.faiss_vector_id
                    """,
                    (chunk_id, MODEL_NAME, DIM, idx),
                )
        conn.commit()


def main() -> None:
    chunk_ids, texts = fetch_chunks()
    if not texts:
        raise RuntimeError("No chunk data found. Run the ingest pipeline before building FAISS index.")

    print(f"chunks: {len(texts)}")
    embeddings = embedder.encode(texts)
    embeddings = np.array(embeddings, dtype="float32")

    index = faiss.IndexFlatIP(DIM)
    index.add(embeddings)

    tmp_path = Path(tempfile.gettempdir()) / "chunks.index"
    try:
        faiss.write_index(index, str(tmp_path))
        shutil.copy2(tmp_path, FAISS_PATH)
        print(f"[OK] faiss index copied to: {FAISS_PATH}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

    write_embedding_meta(chunk_ids)
    print("faiss ntotal:", index.ntotal)


if __name__ == "__main__":
    main()
