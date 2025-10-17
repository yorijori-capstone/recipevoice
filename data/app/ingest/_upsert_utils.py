# 프로젝트 루트에서
# data/app/ingest/_upsert_utils.py
from __future__ import annotations
import os, sqlite3, yaml, hashlib, uuid
from typing import Optional, Tuple, Dict, Any

# 루트(config.yaml) 기준 경로 계산
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
CFG_PATH = os.path.join(ROOT, "config.yaml")
with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)
DB_PATH = os.path.join(ROOT, CFG["paths"]["sqlite_path"])

def get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

# (선택) 텍스트 기반 안정 ID 생성기 — 원본에 ID가 없을 때만 사용
def _mk_id(prefix: str, *parts: str) -> str:
    base = "||".join([p if p is not None else "" for p in parts])
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{h}"

# -------------------------
# UPSERT 함수들
# -------------------------
def upsert_recipe(
    cur,
    recipe_id,
    title,
    source,
    external_id,
    author,
    servings,
    total_time,
    difficulty=None,
):
    rid = recipe_id

    # 1) (source, external_id)로 먼저 존재 확인
    if not rid and external_id and source:
        cur.execute(
            "SELECT recipe_id FROM recipe WHERE source=? AND external_id=?",
            (source, external_id)
        )
        row = cur.fetchone()
        if row:
            rid = row[0]

    # 2) 없으면 새 아이디 생성/할당
    if not rid:
        rid = str(external_id) if external_id is not None else str(uuid.uuid4())

    # 3) 이후는 PK 타깃 업서트 1방이면 끝
    cur.execute(
        """
        INSERT INTO recipe (recipe_id, title, source, external_id, author, servings, total_time, difficulty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(recipe_id) DO UPDATE SET
            title       = COALESCE(excluded.title,       recipe.title),
            source      = COALESCE(excluded.source,      recipe.source),
            external_id = COALESCE(excluded.external_id, recipe.external_id),
            author      = COALESCE(excluded.author,      recipe.author),
            servings    = COALESCE(excluded.servings,    recipe.servings),
            total_time  = COALESCE(excluded.total_time,  recipe.total_time),
            difficulty  = COALESCE(excluded.difficulty,  recipe.difficulty)
        WHERE
            COALESCE(excluded.title,       recipe.title)       IS NOT recipe.title OR
            COALESCE(excluded.source,      recipe.source)      IS NOT recipe.source OR
            COALESCE(excluded.external_id, recipe.external_id) IS NOT recipe.external_id OR
            COALESCE(excluded.author,      recipe.author)      IS NOT recipe.author OR
            COALESCE(excluded.servings,    recipe.servings)    IS NOT recipe.servings OR
            COALESCE(excluded.total_time,  recipe.total_time)  IS NOT recipe.total_time OR
            COALESCE(excluded.difficulty,  recipe.difficulty)  IS NOT recipe.difficulty
        """,
        (rid, title, source, external_id, author, servings, total_time, difficulty)
    )
    return rid



def upsert_step(cur: sqlite3.Cursor,
                step_id: Optional[str],
                recipe_id: str,
                step_no: Optional[int],
                text: str,
                time_hint_sec: Optional[int] = None,
                tools_json: Optional[str] = None,
                warnings_json: Optional[str] = None,
                meta_json: Optional[str] = None) -> str:
    """
    step_id가 주어지면 해당 키로 upsert.
    step_id가 없고 step_no가 있으면 (recipe_id, step_no)로 기존 레코드 탐색 후 재사용.
    """
    if step_id:
        sid = step_id
    else:
        if step_no is not None:
            cur.execute("""
                SELECT step_id FROM step
                WHERE recipe_id=? AND step_no=?
                LIMIT 1
            """, (recipe_id, step_no))
            row = cur.fetchone()
            if row:
                sid = row["step_id"]
            else:
                sid = _mk_id("stp", recipe_id, str(step_no), text[:50])
        else:
            sid = _mk_id("stp", recipe_id, text[:50])

    cur.execute("""
        INSERT INTO step (step_id, recipe_id, step_no, text, time_hint_sec, tools_json, warnings_json, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(step_id) DO UPDATE SET
            recipe_id=excluded.recipe_id,
            step_no=excluded.step_no,
            text=excluded.text,
            time_hint_sec=excluded.time_hint_sec,
            tools_json=excluded.tools_json,
            warnings_json=excluded.warnings_json,
            meta_json=excluded.meta_json
    """, (sid, recipe_id, step_no, text, time_hint_sec, tools_json, warnings_json, meta_json))
    return sid


def upsert_chunk(cur: sqlite3.Cursor,
                chunk_id: Optional[str],
                recipe_id: str,
                step_id: Optional[str],
                step_no: Optional[int],
                section: Optional[str],
                text: str,
                meta_json: Optional[str] = None) -> str:
    """
    정책:
    - chunk_id 있으면 그 키로 upsert
    - 없고 (recipe_id, step_no)가 있으면 해당 조합 재사용(UNIQUE로 보장)
    - 둘 다 없으면 내용기반 해시 id 생성
    """
    if chunk_id:
        cid = chunk_id
    elif step_no is not None:
        cur.execute("""
            SELECT chunk_id FROM chunk
            WHERE recipe_id=? AND step_no=?
            LIMIT 1
        """, (recipe_id, step_no))
        row = cur.fetchone()
        if row:
            cid = row["chunk_id"]
        else:
            cid = _mk_id("chk", recipe_id, str(step_no), text[:50])
    else:
        cid = _mk_id("chk", recipe_id, text[:80])

    # 1차: chunk_id 기반 upsert
    cur.execute("""
        INSERT INTO chunk (chunk_id, recipe_id, step_id, step_no, section, text, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chunk_id) DO UPDATE SET
            recipe_id=excluded.recipe_id,
            step_id=excluded.step_id,
            step_no=excluded.step_no,
            section=excluded.section,
            text=excluded.text,
            meta_json=excluded.meta_json
    """, (cid, recipe_id, step_id, step_no, section, text, meta_json))

    # 2차: (recipe_id, step_no) UNIQUE 위반은 조용히 무시되므로 감지 로그를 원하면 별도 SELECT 비교
    return cid


def upsert_recipe_doc(cur: sqlite3.Cursor,
                    recipe_id: str,
                    source_url: Optional[str],
                    raw_json: Optional[str]) -> None:
    cur.execute("""
        INSERT INTO recipe_doc (recipe_id, source_url, raw_json)
        VALUES (?, ?, ?)
        ON CONFLICT(recipe_id) DO UPDATE SET
            source_url=COALESCE(excluded.source_url, source_url),
            raw_json=COALESCE(excluded.raw_json, raw_json)
    """, (recipe_id, source_url, raw_json))
