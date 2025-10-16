from __future__ import annotations

import logging
import sqlite3
from typing import List

import faiss  # type: ignore
import numpy as np

from data.app.emb_local import LocalEmbedder
from ..schemas.search import SearchHit

logger = logging.getLogger(__name__)


class FaissRetriever:
    def __init__(self, index: faiss.Index, embed_model: str, sqlite_conn: sqlite3.Connection | None = None):
        self.index = index
        self.embedder = LocalEmbedder(embed_model)
        self.sqlite = sqlite_conn

    def search(self, query: str, k: int = 5) -> List[SearchHit]:
        if not query.strip():
            return []
        try:
            q = self.embedder.encode([query])  # float32 normalized
            D, I = self.index.search(q, k)
            hits: List[SearchHit] = []
            # Attempt to resolve chunk metadata if available (safe by column checks)
            if self.sqlite is not None:
                self.sqlite.row_factory = sqlite3.Row
                cur = self.sqlite.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chunk'")
                has_chunk = cur.fetchone() is not None
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chunk_embedding_meta'")
                has_meta_tbl = cur.fetchone() is not None
            else:
                has_chunk = False
                has_meta_tbl = False

            for rank, (dist, idx) in enumerate(zip(D[0].tolist(), I[0].tolist())):
                if idx == -1:
                    continue
                text = f"chunk#{idx}"
                recipe_id = None
                step_no = None
                chunk_id = str(idx)
                if self.sqlite is not None:
                    cur = self.sqlite.cursor()
                    if has_chunk:
                        try:
                            # Discover available columns
                            cur.execute("PRAGMA table_info(chunk)")
                            cols = {r[1] for r in cur.fetchall()}
                            sel_cols = [c for c in ["text", "recipe_id", "step_no"] if c in cols]
                            if sel_cols:
                                projection = ", ".join(sel_cols)
                                # Prefer rowid-based lookup when possible
                                cur.execute(
                                    f"SELECT {projection} FROM chunk WHERE rowid=?",
                                    (idx + 1,),
                                )
                                row = cur.fetchone()
                                if row:
                                    # Map by known positions
                                    col_to_val = {name: row[i] for i, name in enumerate(sel_cols)}
                                    text = col_to_val.get("text", text) or text
                                    recipe_id = col_to_val.get("recipe_id", recipe_id)
                                    step_no = col_to_val.get("step_no", step_no)
                        except Exception:
                            pass
                    elif has_meta_tbl:
                        try:
                            cur.execute("PRAGMA table_info(chunk_embedding_meta)")
                            cols = {r[1] for r in cur.fetchall()}
                            sel_cols = [c for c in ["chunk_id", "text", "recipe_id", "step_no"] if c in cols]
                            if sel_cols:
                                projection = ", ".join(sel_cols)
                                # Use vector_idx when present, otherwise skip metadata
                                if "vector_idx" in cols:
                                    cur.execute(
                                        f"SELECT {projection} FROM chunk_embedding_meta WHERE vector_idx=?",
                                        (idx,),
                                    )
                                    row = cur.fetchone()
                                    if row:
                                        col_to_val = {name: row[i] for i, name in enumerate(sel_cols)}
                                        if "chunk_id" in col_to_val and col_to_val["chunk_id"] is not None:
                                            chunk_id = str(col_to_val["chunk_id"])
                                        text = col_to_val.get("text", text) or text
                                        recipe_id = col_to_val.get("recipe_id", recipe_id)
                                        step_no = col_to_val.get("step_no", step_no)
                        except Exception:
                            pass

                hits.append(
                    SearchHit(
                        chunk_id=chunk_id,
                        text=text,
                        score=float(dist),
                        recipe_id=recipe_id if recipe_id is not None else None,
                        step_no=step_no if step_no is not None else None,
                    )
                )

            return hits
        except Exception as e:
            logger.exception("Retriever search failed: %s", e)
            # TODO: FTS fallback using chunk_fts table
            return []
