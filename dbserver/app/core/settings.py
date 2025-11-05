# dbserver/app/core/settings.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

from data.app.config_loader import load_config


@dataclass(frozen=True)
class AppSettings:
    faiss_index_path: Path
    embed_model: str
    top_k: int
    conn_args: Dict[str, Any]
    db_info: Dict[str, Any]


def load_settings() -> AppSettings:
    """Load project settings from config.yaml with PostgreSQL connection info."""
    candidates = [
        Path("configs/config.yaml"),
        Path("config.yaml"),
    ]
    cfg = None
    cfg_path = None
    for path in candidates:
        if path.exists():
            cfg = load_config(path)
            cfg_path = path.resolve()
            break
    if cfg is None or cfg_path is None:
        raise FileNotFoundError("config.yaml not found. Checked configs/config.yaml and config.yaml")

    root = cfg_path.parent
    paths_cfg = cfg.get("paths", {}) or {}
    embedding_cfg = cfg.get("embedding", {}) or {}
    faiss_cfg = cfg.get("faiss", {}) or {}
    db_cfg = cfg.get("database") or {}
    if not db_cfg:
        raise RuntimeError("database configuration missing in config.yaml")

    faiss_rel = paths_cfg.get("faiss_index_path", "data/storage/vectorstore/chunks.index")
    faiss_path = (root / faiss_rel).resolve()
    if not faiss_path.exists():
        raise FileNotFoundError(
            f"FAISS index not found at '{faiss_path}'. "
            "재생성하려면 `python -m data.app.ingest.build_faiss`를 실행하세요."
        )

    embed_model = embedding_cfg.get(
        "model", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    top_k = int(faiss_cfg.get("top_k", 5))

    conn_args: Dict[str, Any] = {
        "dbname": db_cfg.get("name"),
        "user": db_cfg.get("user"),
        "password": db_cfg.get("password"),
        "host": db_cfg.get("host", "127.0.0.1"),
        "port": db_cfg.get("port", 5432),
    }
    conn_args.update(db_cfg.get("options") or {})

    db_info = {
        "name": db_cfg.get("name"),
        "user": db_cfg.get("user"),
        "host": db_cfg.get("host", "127.0.0.1"),
        "port": db_cfg.get("port", 5432),
    }

    return AppSettings(
        faiss_index_path=faiss_path,
        embed_model=embed_model,
        top_k=top_k,
        conn_args=conn_args,
        db_info=db_info,
    )
