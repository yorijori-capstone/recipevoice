"""RAG search utilities backed by PostgreSQL and FAISS."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import faiss
import psycopg
from psycopg.rows import dict_row

import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data.app.emb_local import LocalEmbedder
from data.app.config_loader import load_config


try:
    CFG = load_config(ROOT_DIR / "config.yaml")

    DB_CFG = CFG.get("database") or {}
    if not DB_CFG:
        raise RuntimeError("database configuration missing in config.yaml")
    INDEX_PATH = ROOT_DIR / CFG["paths"]["faiss_index_path"]
    MODEL_NAME = CFG["embedding"]["model"]
    TOP_K = CFG["faiss"]["top_k"]
    SCORE_THRESHOLD = CFG["faiss"].get("score_threshold", 0.45)

    print("--- [RAG] Loading FAISS index and embedding model... ---")
    INDEX = faiss.read_index(str(INDEX_PATH))
    EMBEDDER = LocalEmbedder(MODEL_NAME)
    print(f"--- [RAG] Resources loaded successfully. Score threshold set to {SCORE_THRESHOLD} ---")
    RAG_RESOURCES_LOADED = True
except Exception as exc:  # pragma: no cover - defensive logging
    print(f"--- [RAG] CRITICAL: Failed to load RAG resources: {exc} ---")
    RAG_RESOURCES_LOADED = False
    INDEX = None
    EMBEDDER = None


def _build_conn_args(db_cfg: Dict[str, Any]) -> Dict[str, Any]:
    args: Dict[str, Any] = {
        "dbname": db_cfg.get("name"),
        "user": db_cfg.get("user"),
        "password": db_cfg.get("password"),
        "host": db_cfg.get("host", "127.0.0.1"),
        "port": db_cfg.get("port", 5432),
    }
    extra = db_cfg.get("options") or {}
    args.update(extra)
    return args


CONN_ARGS = _build_conn_args(DB_CFG)


def _get_conn() -> psycopg.Connection:
    if not DB_CFG:
        raise RuntimeError("database configuration missing; check config.yaml")
    return psycopg.connect(row_factory=dict_row, **CONN_ARGS)


def reload_resources(
    *,
    database_config: Optional[Dict[str, Any]] = None,
    faiss_index_path: Optional[Path] = None,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    global DB_CFG, INDEX_PATH, MODEL_NAME, INDEX, EMBEDDER, RAG_RESOURCES_LOADED, CONN_ARGS

    if database_config:
        DB_CFG = database_config
        CONN_ARGS = _build_conn_args(DB_CFG)
    if faiss_index_path:
        INDEX_PATH = Path(faiss_index_path).resolve()
    if model_name:
        MODEL_NAME = model_name

    info = {
        "database": {
            "host": DB_CFG.get("host"),
            "port": DB_CFG.get("port"),
            "name": DB_CFG.get("name"),
            "user": DB_CFG.get("user"),
        },
        "faiss_index_path": str(INDEX_PATH),
        "model_name": MODEL_NAME,
    }

    try:
        INDEX = faiss.read_index(str(INDEX_PATH))
        EMBEDDER = LocalEmbedder(MODEL_NAME)
        RAG_RESOURCES_LOADED = True
        print(f"--- [RAG] Resources reloaded ({info}) ---")
    except Exception as exc:  # pragma: no cover - defensive logging
        RAG_RESOURCES_LOADED = False
        print(f"[ERROR] Failed to reload RAG resources: {exc}")
        raise

    return info


def _vector_candidates(query: str, limit: int) -> List[Tuple[str, float]]:
    if not RAG_RESOURCES_LOADED:
        return []

    query_vector = EMBEDDER.encode([query])
    distances, vector_ids = INDEX.search(query_vector, limit)
    id_list = vector_ids[0].tolist()
    score_list = distances[0].tolist()
    if not id_list:
        return []

    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT faiss_vector_id, chunk_id
            FROM chunk_embedding_meta
            WHERE faiss_vector_id = ANY(%s)
            """,
            (id_list,),
        )
        rows = cur.fetchall()

    id_to_chunk = {row["faiss_vector_id"]: row["chunk_id"] for row in rows}

    results: List[Tuple[str, float]] = []
    for vec_id, score in zip(id_list, score_list):
        chunk_id = id_to_chunk.get(vec_id)
        if not chunk_id:
            continue
        results.append((chunk_id, float(score)))
    return results


def _bm25_candidates(query: str, limit: int) -> List[Tuple[str, float]]:
    if not query.strip():
        return []

    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT chunk_id,
                   ts_rank_cd(search_vector, websearch_to_tsquery('simple', %s)) AS score
            FROM chunk
            WHERE search_vector @@ websearch_to_tsquery('simple', %s)
            ORDER BY score DESC
            LIMIT %s
            """,
            (query, query, limit),
        )
        rows = cur.fetchall()

    return [(row["chunk_id"], float(row["score"])) for row in rows if row["score"] is not None]


def _fetch_chunk_metadata(chunk_ids: Sequence[str]) -> Dict[str, Dict[str, Any]]:
    if not chunk_ids:
        return {}

    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                c.chunk_id,
                c.recipe_id,
                c.section,
                c.step_id,
                c.step_no,
                c.text AS chunk_text,
                c.meta_json AS chunk_meta,
                r.title AS recipe_title,
                r.source AS recipe_source,
                r.external_id AS recipe_external_id,
                r.servings AS recipe_servings,
                r.total_time AS recipe_total_time,
                r.difficulty AS recipe_difficulty,
                rd.source_url,
                s.text AS step_text
            FROM chunk c
            JOIN recipe r ON r.recipe_id = c.recipe_id
            LEFT JOIN recipe_doc rd ON rd.recipe_id = r.recipe_id
            LEFT JOIN step s ON s.step_id = c.step_id
            WHERE c.chunk_id = ANY(%s)
            """,
            (chunk_ids,),
        )
        rows = cur.fetchall()

    metadata: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        chunk_id = row.pop("chunk_id")
        meta_json = row.get("chunk_meta")
        if isinstance(meta_json, str):
            try:
                row["chunk_meta"] = json.loads(meta_json)
            except json.JSONDecodeError:
                pass
        metadata[chunk_id] = dict(row)
    return metadata


def _fuse_candidates(
    dense_results: Sequence[Tuple[str, float]],
    sparse_results: Sequence[Tuple[str, float]],
    *,
    dense_weight: float = 1.0,
    sparse_weight: float = 0.5,
    rrf_k: int = 60,
) -> Dict[str, float]:
    scores: Dict[str, float] = {}

    for idx, (chunk_id, score) in enumerate(dense_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + dense_weight * score + 1.0 / (rrf_k + idx + 1)

    for idx, (chunk_id, score) in enumerate(sparse_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + sparse_weight * score + 1.0 / (rrf_k + idx + 1)

    return scores


def search_rag_chunks(query: str, top_k: Optional[int] = None) -> List[Dict[str, Any]]:
    if not RAG_RESOURCES_LOADED:
        print("[ERROR] RAG system is not available due to a resource loading error.")
        return []

    if top_k is None:
        top_k = TOP_K

    print(f"[RAG] search_rag_chunks query='{query}' top_k={top_k}")

    dense_candidates = _vector_candidates(query, limit=max(top_k * 8, 64))
    sparse_candidates = _bm25_candidates(query, limit=max(top_k * 6, 48))
    print(
        f"[RAG] dense_candidates={len(dense_candidates)} sparse_candidates={len(sparse_candidates)}"
    )

    dense_score_map = {chunk_id: score for chunk_id, score in dense_candidates}
    sparse_score_map = {chunk_id: score for chunk_id, score in sparse_candidates}

    fused_scores = _fuse_candidates(dense_candidates, sparse_candidates)

    if not fused_scores:
        sparse_only = sparse_candidates[:top_k]
        fused_scores = {chunk_id: score for chunk_id, score in sparse_only}
        if fused_scores:
            print("[RAG] fallback to sparse-only results")

    ranked_chunks = sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)[:top_k]
    chunk_ids = [chunk_id for chunk_id, _ in ranked_chunks]
    metadata = _fetch_chunk_metadata(chunk_ids)

    results: List[Dict[str, Any]] = []
    for chunk_id, score in ranked_chunks:
        meta = metadata.get(chunk_id)
        if not meta:
            continue
        dense_score = dense_score_map.get(chunk_id, 0.0)
        sparse_score = sparse_score_map.get(chunk_id, 0.0)
        if dense_score_map and dense_score < SCORE_THRESHOLD:
            continue
        item = {
            "chunk_id": chunk_id,
            "score": float(score),
            "dense_score": float(dense_score),
            "sparse_score": float(sparse_score),
            **meta,
        }
        chunk_text = item.get("chunk_text") or ""
        snippet = chunk_text[:240]
        if len(chunk_text) > 240:
            snippet += "…"
        item["snippet"] = snippet
        results.append(item)

    if not results:
        print("[RAG] no chunks passed score threshold; returning empty list")
    else:
        top_preview = results[0]
        print(
            f"[RAG] top chunk {top_preview['chunk_id']} score={top_preview['score']:.3f} dense={top_preview['dense_score']:.3f} "
            f"recipe={top_preview.get('recipe_id')}"
        )

    return results


def search_rag(query: str, top_k: Optional[int] = None) -> List[str]:
    limit = top_k or TOP_K
    chunks = search_rag_chunks(query, top_k=limit)
    final_recipe_ids: List[str] = []
    seen_recipe_ids = set()

    for item in chunks:
        recipe_id = item.get("recipe_id")
        if not recipe_id or recipe_id in seen_recipe_ids:
            continue
        final_recipe_ids.append(recipe_id)
        seen_recipe_ids.add(recipe_id)
        if len(final_recipe_ids) >= limit:
            break

    print(f"[RAG] search_rag recipes={final_recipe_ids}")
    return final_recipe_ids
