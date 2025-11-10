# dbserver/app/core/deps.py
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator, Optional

import faiss  # type: ignore
import psycopg
from psycopg.rows import dict_row

from .settings import AppSettings, load_settings

logger = logging.getLogger(__name__)

_SETTINGS: Optional[AppSettings] = None
_FAISS_INDEX: Optional[faiss.Index] = None


def get_settings() -> AppSettings:
    global _SETTINGS
    if _SETTINGS is None:
        _SETTINGS = load_settings()
    return _SETTINGS


def get_faiss_index() -> faiss.Index:
    global _FAISS_INDEX
    if _FAISS_INDEX is None:
        settings = get_settings()
        try:
            _FAISS_INDEX = faiss.read_index(str(settings.faiss_index_path))  # type: ignore
            logger.info("Loaded FAISS index: ntotal=%s", _FAISS_INDEX.ntotal)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to read FAISS index at {settings.faiss_index_path}: {exc}"
            )
    return _FAISS_INDEX


@contextmanager
def pg_conn() -> Generator[psycopg.Connection, None, None]:
    settings = get_settings()
    conn = psycopg.connect(row_factory=dict_row, **settings.conn_args)
    try:
        yield conn
    finally:
        conn.close()
