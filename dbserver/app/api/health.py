from __future__ import annotations

import logging
from fastapi import APIRouter

from ..core.deps import get_faiss_index, get_sqlite
from ..schemas.common import HealthResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
def health():
    # Check FAISS
    index = get_faiss_index()
    ntotal = int(index.ntotal)

    # Check DB
    db_ok = True
    try:
        conn = get_sqlite()
        conn.execute("SELECT 1")
    except Exception:
        db_ok = False

    return HealthResponse(status="ok", faiss_ntotal=ntotal, db_ok=db_ok)
