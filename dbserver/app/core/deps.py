from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from typing import Generator, Optional

import faiss  # type: ignore

from .settings import load_settings

logger = logging.getLogger(__name__)


_SQLITE_CONN: Optional[sqlite3.Connection] = None
_FAISS_INDEX: Optional[faiss.Index] = None
_SETTINGS = None


def get_settings():
    global _SETTINGS
    if _SETTINGS is None:
        _SETTINGS = load_settings()
    return _SETTINGS


def get_sqlite() -> sqlite3.Connection:
    global _SQLITE_CONN
    if _SQLITE_CONN is None:
        settings = get_settings()
        try:
            _SQLITE_CONN = sqlite3.connect(settings.sqlite_path, check_same_thread=False)
        except Exception as e:
            raise RuntimeError(f"Failed to open sqlite at {settings.sqlite_path}: {e}")
    return _SQLITE_CONN


def get_faiss_index() -> faiss.Index:
    global _FAISS_INDEX
    if _FAISS_INDEX is None:
        settings = get_settings()
        try:
            _FAISS_INDEX = faiss.read_index(settings.faiss_index_path)  # type: ignore
            logger.info("Loaded FAISS index: ntotal=%s", _FAISS_INDEX.ntotal)
        except Exception as e:
            raise RuntimeError(
                f"Failed to read FAISS index at {settings.faiss_index_path}: {e}"
            )
    return _FAISS_INDEX


@contextmanager
def sqlite_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = get_sqlite()
    try:
        yield conn
    finally:
        # Keep singleton connection alive; no close here
        pass
