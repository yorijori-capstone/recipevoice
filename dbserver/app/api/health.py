from __future__ import annotations

import logging
from fastapi import APIRouter

from ..core.deps import get_faiss_index, pg_conn
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
        with pg_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
    except Exception as exc:
        logger.exception("DB health check failed: %s", exc)
        db_ok = False

    return HealthResponse(status="ok", faiss_ntotal=ntotal, db_ok=db_ok)
