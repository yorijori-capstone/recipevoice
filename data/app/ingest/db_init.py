# data/app/ingest/db_init.py
"""Initialize the PostgreSQL schema used by the RecipeVoice project."""

from __future__ import annotations

import textwrap
from pathlib import Path

import psycopg
import yaml

ROOT = Path(__file__).resolve().parents[3]
CFG_PATH = ROOT / "config.yaml"


def _load_config() -> dict:
    with CFG_PATH.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _connect(db_cfg: dict) -> psycopg.Connection:
    extra = db_cfg.get("options") or {}
    return psycopg.connect(
        dbname=db_cfg.get("name"),
        user=db_cfg.get("user"),
        password=db_cfg.get("password"),
        host=db_cfg.get("host", "127.0.0.1"),
        port=db_cfg.get("port", 5432),
        **extra,
    )


DDL_STATEMENTS = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS recipe (
            recipe_id      TEXT PRIMARY KEY,
            title          TEXT NOT NULL,
            source         TEXT NOT NULL,
            external_id    TEXT,
            author         TEXT,
            servings       TEXT,
            total_time     TEXT,
            difficulty     TEXT,
            created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
        """
    ),
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_recipe_source_ext ON recipe (source, external_id) WHERE external_id IS NOT NULL",
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS recipe_doc (
            recipe_id  TEXT PRIMARY KEY REFERENCES recipe(recipe_id) ON DELETE CASCADE,
            source_url TEXT,
            raw_json   TEXT
        )
        """
    ),
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS step (
            step_id        TEXT PRIMARY KEY,
            recipe_id      TEXT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
            step_no        INTEGER,
            text           TEXT NOT NULL,
            time_hint_sec  INTEGER,
            tools_json     TEXT,
            warnings_json  TEXT,
            meta_json      TEXT
        )
        """
    ),
    "CREATE INDEX IF NOT EXISTS idx_step_recipe ON step (recipe_id, step_no)",
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS chunk (
            chunk_id      TEXT PRIMARY KEY,
            recipe_id     TEXT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
            step_id       TEXT REFERENCES step(step_id),
            step_no       INTEGER,
            section       TEXT,
            text          TEXT NOT NULL,
            meta_json     TEXT,
            search_vector TSVECTOR
        )
        """
    ),
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_chunk_recipe_step_no ON chunk (recipe_id, step_no)",
    "CREATE INDEX IF NOT EXISTS idx_chunk_recipe ON chunk (recipe_id)",
    "CREATE INDEX IF NOT EXISTS idx_chunk_search_vector ON chunk USING GIN (search_vector)",
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS chunk_embedding_meta (
            chunk_id        TEXT PRIMARY KEY REFERENCES chunk(chunk_id) ON DELETE CASCADE,
            model_name      TEXT NOT NULL,
            dim             INTEGER NOT NULL,
            created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            faiss_vector_id INTEGER NOT NULL UNIQUE
        )
        """
    ),
    textwrap.dedent(
        """
        CREATE OR REPLACE FUNCTION recipe_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    ),
    "DROP TRIGGER IF EXISTS recipe_set_updated_at_trigger ON recipe",
    "CREATE TRIGGER recipe_set_updated_at_trigger BEFORE UPDATE ON recipe FOR EACH ROW EXECUTE FUNCTION recipe_set_updated_at()",
    textwrap.dedent(
        """
        CREATE OR REPLACE FUNCTION chunk_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('simple', COALESCE(NEW.text, ''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    ),
    "DROP TRIGGER IF EXISTS chunk_search_vector_trigger ON chunk",
    "CREATE TRIGGER chunk_search_vector_trigger BEFORE INSERT OR UPDATE ON chunk FOR EACH ROW EXECUTE FUNCTION chunk_update_search_vector()",
    textwrap.dedent(
        """
        CREATE TABLE IF NOT EXISTS store_recommendations (
            id             BIGSERIAL PRIMARY KEY,
            recipe_id      TEXT NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
            ingredient     TEXT NOT NULL,
            store_name     TEXT NOT NULL,
            address        TEXT,
            lat            DOUBLE PRECISION,
            lon            DOUBLE PRECISION,
            search_keyword TEXT,
            search_date    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
        """
    ),
    "CREATE INDEX IF NOT EXISTS idx_store_recommendations_recipe ON store_recommendations (recipe_id, ingredient)",
]


def initialize_database() -> None:
    cfg = _load_config()
    db_cfg = cfg.get("database")
    if not db_cfg:
        raise RuntimeError("database configuration missing in config.yaml")

    with _connect(db_cfg) as conn:
        with conn.cursor() as cur:
            for stmt in DDL_STATEMENTS:
                cur.execute(stmt)
        conn.commit()

    print(
        f"PostgreSQL schema initialized for database '{db_cfg.get('name')}' on host {db_cfg.get('host', '127.0.0.1')}"
    )


if __name__ == "__main__":
    initialize_database()
