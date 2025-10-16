from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.logging import setup_logging
from .core.deps import get_faiss_index, get_sqlite, get_settings
from .api.health import router as health_router
from .api.search import router as search_router
from .api.recipes import router as recipes_router
from .api.step import router as step_router


setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="RecipeVoice API", version="0.1.0")

# CORS: allow local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    settings = get_settings()
    logger.info("settings.sqlite_path=%s", settings.sqlite_path)
    logger.info("settings.faiss_index_path=%s", settings.faiss_index_path)

    # Preload resources
    conn = get_sqlite()
    conn.execute("SELECT 1")
    index = get_faiss_index()
    logger.info("faiss.ntotal=%s", index.ntotal)


# Routers
app.include_router(health_router)
app.include_router(search_router)
app.include_router(recipes_router)
# app.include_router(plan_router)  # planner feature disabled (handled by another team)
app.include_router(step_router)
