# dbserver/app/db/postgres.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Mapping

import psycopg


def _row_to_dict(row: Mapping[str, Any]) -> Dict[str, Any]:
    return dict(row)


def get_recipe(conn: psycopg.Connection, recipe_id: str) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT recipe_id, title, servings, source
            FROM recipe
            WHERE recipe_id = %s
            """,
            (recipe_id,),
        )
        row = cur.fetchone()
    return _row_to_dict(row) if row else None


def get_recipe_steps(conn: psycopg.Connection, recipe_id: str) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT recipe_id,
                   COALESCE(step_no, 0) AS step_no,
                   text,
                   time_hint_sec,
                   warnings_json
            FROM step
            WHERE recipe_id = %s
            ORDER BY step_no ASC NULLS LAST
            """,
            (recipe_id,),
        )
        rows = cur.fetchall()
    return [_row_to_dict(row) for row in rows]
