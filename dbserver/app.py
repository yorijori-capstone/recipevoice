"""Lightweight read-only API for PostgreSQL-backed recipe data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.rows import dict_row
import yaml
from fastapi import FastAPI, HTTPException, Query

BASE_DIR = Path(__file__).resolve().parent.parent

with (BASE_DIR / "config.yaml").open("r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

DB_CFG = CFG.get("database")
if not DB_CFG:
    raise RuntimeError("database configuration missing in config.yaml")

CONN_ARGS: Dict[str, Any] = {
    "dbname": DB_CFG.get("name"),
    "user": DB_CFG.get("user"),
    "password": DB_CFG.get("password"),
    "host": DB_CFG.get("host", "127.0.0.1"),
    "port": DB_CFG.get("port", 5432),
}
CONN_ARGS.update(DB_CFG.get("options") or {})


def _get_conn() -> psycopg.Connection:
    return psycopg.connect(row_factory=dict_row, **CONN_ARGS)


def _try_json_load(value: Optional[str]) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


app = FastAPI(
    title="RecipeVoice DB Service",
    description="Read-only REST API exposing recipe data stored in PostgreSQL.",
    version="0.2.0",
)


@app.get("/health")
def health():
    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(1) AS total FROM recipe")
        count = cur.fetchone()["total"]

    return {
        "status": "ok",
        "database": {
            "host": DB_CFG.get("host"),
            "port": DB_CFG.get("port"),
            "name": DB_CFG.get("name"),
            "user": DB_CFG.get("user"),
        },
        "recipes": count,
    }


@app.get("/recipes")
def list_recipes(
    q: Optional[str] = Query(
        default=None,
        description="제목 또는 recipe_id를 포함하는 텍스트 검색",
    ),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    base_sql = """
        SELECT recipe_id, title, source, external_id,
               servings, total_time, difficulty, created_at, updated_at
        FROM recipe
    """
    params: List[Any] = []
    if q:
        base_sql += " WHERE title ILIKE %s OR recipe_id ILIKE %s"
        like = f"%{q}%"
        params.extend([like, like])

    base_sql += " ORDER BY updated_at DESC NULLS LAST LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(base_sql, params)
        rows = cur.fetchall()

    return [dict(row) for row in rows]


@app.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT recipe_id, title, source, external_id, author,
                   servings, total_time, difficulty, created_at, updated_at
            FROM recipe WHERE recipe_id=%s
            """,
            (recipe_id,),
        )
        recipe = cur.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        cur.execute(
            "SELECT source_url, raw_json FROM recipe_doc WHERE recipe_id=%s",
            (recipe_id,),
        )
        doc = cur.fetchone()

        cur.execute(
            """
            SELECT step_id, step_no, text, time_hint_sec,
                   tools_json, warnings_json, meta_json
            FROM step
            WHERE recipe_id=%s
            ORDER BY step_no NULLS LAST, step_id
            """,
            (recipe_id,),
        )
        steps = cur.fetchall()

        cur.execute(
            """
            SELECT chunk_id, section, step_id, step_no, text, meta_json
            FROM chunk
            WHERE recipe_id=%s
            ORDER BY step_no NULLS LAST, chunk_id
            """,
            (recipe_id,),
        )
        chunks = cur.fetchall()

    recipe_payload = dict(recipe)
    doc_payload = dict(doc) if doc else {}
    doc_payload["raw_json"] = _try_json_load(doc_payload.get("raw_json"))

    steps_payload = []
    for row in steps:
        data = dict(row)
        data["tools_json"] = _try_json_load(data.get("tools_json"))
        data["warnings_json"] = _try_json_load(data.get("warnings_json"))
        data["meta_json"] = _try_json_load(data.get("meta_json"))
        steps_payload.append(data)

    chunks_payload = []
    for row in chunks:
        data = dict(row)
        data["meta_json"] = _try_json_load(data.get("meta_json"))
        chunks_payload.append(data)

    return {
        "recipe": recipe_payload,
        "doc": doc_payload,
        "steps": steps_payload,
        "chunks": chunks_payload,
    }
