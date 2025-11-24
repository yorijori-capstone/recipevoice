"""Utility helpers for PostgreSQL ingest pipeline."""

from __future__ import annotations

import hashlib
import os
import uuid
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row

from data.app.config_loader import load_config

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
CFG_PATH = os.path.join(ROOT, "config.yaml")

CFG = load_config(CFG_PATH)

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
extra_options = DB_CFG.get("options") or {}
CONN_ARGS.update(extra_options)


def get_conn() -> psycopg.Connection:
    return psycopg.connect(row_factory=dict_row, **CONN_ARGS)


def _mk_id(prefix: str, *parts: str) -> str:
    base = "||".join([p if p is not None else "" for p in parts])
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{h}"


def upsert_recipe(
    cur,
    recipe_id: Optional[str],
    title: str,
    source: str,
    external_id: Optional[str],
    author: Optional[str],
    servings: Optional[str],
    total_time: Optional[str],
    difficulty: Optional[str] = None,
) -> str:
    rid = recipe_id

    if not rid and external_id and source:
        cur.execute(
            "SELECT recipe_id FROM recipe WHERE source=%s AND external_id=%s",
            (source, external_id),
        )
        row = cur.fetchone()
        if row:
            rid = row["recipe_id"]

    if not rid:
        rid = str(external_id) if external_id is not None else str(uuid.uuid4())

    cur.execute(
        """
        INSERT INTO recipe (recipe_id, title, source, external_id, author, servings, total_time, difficulty)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (recipe_id) DO UPDATE SET
            title = EXCLUDED.title,
            source = EXCLUDED.source,
            external_id = EXCLUDED.external_id,
            author = EXCLUDED.author,
            servings = EXCLUDED.servings,
            total_time = EXCLUDED.total_time,
            difficulty = EXCLUDED.difficulty
        """,
        (rid, title, source, external_id, author, servings, total_time, difficulty),
    )
    return rid


def upsert_step(
    cur,
    step_id: Optional[str],
    recipe_id: str,
    step_no: Optional[int],
    text: str,
    time_hint_sec: Optional[int] = None,
    tools_json: Optional[str] = None,
    warnings_json: Optional[str] = None,
    meta_json: Optional[str] = None,
) -> str:
    if step_id:
        sid = step_id
    else:
        if step_no is not None:
            cur.execute(
                "SELECT step_id FROM step WHERE recipe_id=%s AND step_no=%s LIMIT 1",
                (recipe_id, step_no),
            )
            row = cur.fetchone()
            if row:
                sid = row["step_id"]
            else:
                sid = _mk_id("stp", recipe_id, str(step_no), text[:50])
        else:
            sid = _mk_id("stp", recipe_id, text[:50])

    cur.execute(
        """
        INSERT INTO step (step_id, recipe_id, step_no, text, time_hint_sec, tools_json, warnings_json, meta_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (step_id) DO UPDATE SET
            recipe_id = EXCLUDED.recipe_id,
            step_no = EXCLUDED.step_no,
            text = EXCLUDED.text,
            time_hint_sec = EXCLUDED.time_hint_sec,
            tools_json = EXCLUDED.tools_json,
            warnings_json = EXCLUDED.warnings_json,
            meta_json = EXCLUDED.meta_json
        """,
        (sid, recipe_id, step_no, text, time_hint_sec, tools_json, warnings_json, meta_json),
    )
    return sid


def upsert_chunk(
    cur,
    chunk_id: Optional[str],
    recipe_id: str,
    step_id: Optional[str],
    step_no: Optional[int],
    section: Optional[str],
    text: str,
    meta_json: Optional[str] = None,
) -> str:
    if chunk_id:
        cid = chunk_id
    elif step_no is not None:
        cur.execute(
            "SELECT chunk_id FROM chunk WHERE recipe_id=%s AND step_no=%s LIMIT 1",
            (recipe_id, step_no),
        )
        row = cur.fetchone()
        if row:
            cid = row["chunk_id"]
        else:
            cid = _mk_id("chk", recipe_id, str(step_no), text[:50])
    else:
        cid = _mk_id("chk", recipe_id, text[:80])

    cur.execute(
        """
        INSERT INTO chunk (chunk_id, recipe_id, step_id, step_no, section, text, meta_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (chunk_id) DO UPDATE SET
            recipe_id = EXCLUDED.recipe_id,
            step_id = EXCLUDED.step_id,
            step_no = EXCLUDED.step_no,
            section = EXCLUDED.section,
            text = EXCLUDED.text,
            meta_json = EXCLUDED.meta_json
        """,
        (cid, recipe_id, step_id, step_no, section, text, meta_json),
    )
    return cid


def upsert_recipe_doc(
    cur,
    recipe_id: str,
    source_url: Optional[str],
    raw_json: Optional[str],
) -> None:
    cur.execute(
        """
        INSERT INTO recipe_doc (recipe_id, source_url, raw_json)
        VALUES (%s, %s, %s)
        ON CONFLICT (recipe_id) DO UPDATE SET
            source_url = EXCLUDED.source_url,
            raw_json = EXCLUDED.raw_json
        """,
        (recipe_id, source_url, raw_json),
    )


def upsert_voice_plan(
    cur,
    recipe_id: str,
    plan_json: str,
) -> None:
    cur.execute(
        """
        INSERT INTO recipe_voice_plan (recipe_id, plan_json)
        VALUES (%s, %s)
        ON CONFLICT (recipe_id) DO UPDATE SET
            plan_json = EXCLUDED.plan_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (recipe_id, plan_json),
    )
