from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional


def _row_to_dict(cursor: sqlite3.Cursor, row: sqlite3.Row) -> Dict[str, Any]:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def _has_column(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cursor.fetchall()]
    return column in cols


def get_recipe(conn: sqlite3.Connection, recipe_id: int) -> Optional[Dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='recipe'")
    if cur.fetchone() is None:
        return None

    # Select minimal safe columns
    cur.execute("PRAGMA table_info(recipe)")
    cols = [r[1] for r in cur.fetchall()]
    select_cols = [c for c in ["recipe_id", "title", "servings", "source"] if c in cols]
    if not select_cols:
        select_cols = cols  # fallback: select all

    placeholders = ", ".join(select_cols)
    cur.execute(f"SELECT {placeholders} FROM recipe WHERE recipe_id=?", (str(recipe_id),))
    row = cur.fetchone()
    return _row_to_dict(cur, row) if row else None


def get_recipe_steps(conn: sqlite3.Connection, recipe_id: int) -> List[Dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='step'")
    if cur.fetchone() is None:
        return []

    cur.execute("PRAGMA table_info(step)")
    cols = [r[1] for r in cur.fetchall()]
    # Common expected columns
    select_cols = [c for c in ["recipe_id", "step_no", "text", "time_hint_sec", "warnings_json"] if c in cols]
    if not select_cols:
        select_cols = cols

    placeholders = ", ".join(select_cols)
    cur.execute(
        f"SELECT {placeholders} FROM step WHERE recipe_id=? ORDER BY step_no ASC",
        (str(recipe_id),),
    )
    rows = cur.fetchall()
    return [_row_to_dict(cur, r) for r in rows]
