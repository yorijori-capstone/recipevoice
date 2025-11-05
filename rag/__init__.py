"""RAG package public interface."""

from .search import (
    INDEX_PATH,
    MODEL_NAME,
    RAG_RESOURCES_LOADED,
    SCORE_THRESHOLD,
    TOP_K,
    reload_resources,
    search_rag,
    search_rag_chunks,
)

__all__ = [
    "search_rag",
    "search_rag_chunks",
    "reload_resources",
    "INDEX_PATH",
    "MODEL_NAME",
    "TOP_K",
    "SCORE_THRESHOLD",
    "RAG_RESOURCES_LOADED",
]
