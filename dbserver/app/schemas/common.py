from __future__ import annotations

from typing import List

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    faiss_ntotal: int
    db_ok: bool


class ErrorResponse(BaseModel):
    code: str
    message: str
    hint: str | None = None
