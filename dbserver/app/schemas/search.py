from __future__ import annotations

from typing import List

from pydantic import BaseModel


class SearchHit(BaseModel):
    chunk_id: str
    text: str
    score: float
    recipe_id: int | None = None
    step_no: int | None = None


class SearchResponse(BaseModel):
    query: str
    hits: List[SearchHit]
    answer: str
