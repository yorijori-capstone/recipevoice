# dbserver/app/rag/retriever.py
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import faiss  # type: ignore
import psycopg

from data.app.emb_local import LocalEmbedder
from ..schemas.search import SearchHit

logger = logging.getLogger(__name__)


class FaissRetriever:
    def __init__(
        self,
        index: faiss.Index,
        embed_model: str,
        pg_conn: psycopg.Connection | None = None,
    ):
        self.index = index
        self.embedder = LocalEmbedder(embed_model)
        self.pg_conn = pg_conn

    def _fetch_metadata(
        self, vector_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        if self.pg_conn is None or not vector_ids:
            return {}

        valid_ids = [vid for vid in vector_ids if vid >= 0]
        if not valid_ids:
            return {}

        query = """
            SELECT m.faiss_vector_id,
                   m.chunk_id,
                   c.text,
                   c.recipe_id,
                   c.step_no
            FROM chunk_embedding_meta AS m
            JOIN chunk AS c ON c.chunk_id = m.chunk_id
            WHERE m.faiss_vector_id = ANY(%s)
        """
        with self.pg_conn.cursor() as cur:
            cur.execute(query, (valid_ids,))
            rows = cur.fetchall()
        return {row["faiss_vector_id"]: row for row in rows}

    def search(self, query: str, k: int = 5) -> List[SearchHit]:
        if not query.strip():
            return []

        try:
            q_emb = self.embedder.encode([query])
            distances, indices = self.index.search(q_emb, k)

            idx_list = indices[0].tolist()
            meta = self._fetch_metadata(idx_list)
            hits: List[SearchHit] = []

            for score, vec_id in zip(distances[0].tolist(), idx_list):
                if vec_id == -1:
                    continue

                fallback_chunk_id = f"chunk#{vec_id}"
                chunk_meta = meta.get(vec_id, {})
                chunk_id = chunk_meta.get("chunk_id", fallback_chunk_id)
                text = chunk_meta.get("text") or fallback_chunk_id
                recipe_id = chunk_meta.get("recipe_id")
                step_no = chunk_meta.get("step_no")

                hits.append(
                    SearchHit(
                        chunk_id=str(chunk_id),
                        text=text,
                        score=float(score),
                        recipe_id=str(recipe_id) if recipe_id is not None else None,
                        step_no=int(step_no) if step_no is not None else None,
                    )
                )

            return hits
        except Exception as exc:
            logger.exception("Retriever search failed: %s", exc)
            return []
