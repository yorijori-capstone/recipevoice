from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import yaml
from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    # Defaults match requested fixed paths
    sqlite_path: str = Field(default="data/storage/database/recipes.db")
    faiss_index_path: str = Field(default="data/storage/vectorstore/chunks.index")
    top_k: int = 5
    embed_model: str = (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    class Config:
        env_prefix = "RECIPEVOICE_"


def _load_yaml_config() -> Dict[str, Any]:
    # Primary: configs/config.yaml, Fallback: config.yaml at repo root
    candidates = [
        Path("configs/config.yaml"),
        Path("config.yaml"),
    ]
    for path in candidates:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                return data
    return {}


def _flatten_from_nested(raw: Dict[str, Any]) -> Dict[str, Any]:
    # Expecting structure:
    # paths.sqlite_path, paths.faiss_index_path
    # rag.top_k, rag.embed_model
    flattened: Dict[str, Any] = {}
    paths = (raw or {}).get("paths", {}) or {}
    rag = (raw or {}).get("rag", {}) or {}
    if "sqlite_path" in paths:
        flattened["sqlite_path"] = paths["sqlite_path"]
    if "faiss_index_path" in paths:
        flattened["faiss_index_path"] = paths["faiss_index_path"]
    if "top_k" in rag:
        flattened["top_k"] = rag["top_k"]
    if "embed_model" in rag:
        flattened["embed_model"] = rag["embed_model"]
    return flattened


def load_settings() -> AppSettings:
    raw = _load_yaml_config()
    merged = _flatten_from_nested(raw)
    try:
        settings = AppSettings(**merged)
    except ValidationError as e:
        raise RuntimeError(f"Invalid settings: {e}")

    # Validate critical paths exist on startup
    sqlite_path = Path(settings.sqlite_path)
    faiss_path = Path(settings.faiss_index_path)

    if not sqlite_path.exists():
        raise FileNotFoundError(
            f"SQLite database not found at '{sqlite_path}'. Please check configs/config.yaml"
        )
    if not faiss_path.exists():
        raise FileNotFoundError(
            f"FAISS index not found at '{faiss_path}'. Please check configs/config.yaml"
        )
    return settings
