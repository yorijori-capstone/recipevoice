from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..core.deps import get_faiss_index, get_settings, pg_conn
from ..rag.retriever import FaissRetriever
from ..rag.chain import generate_answer
from ..schemas.search import SearchResponse


router = APIRouter()


@router.get("/search", response_model=SearchResponse)
def search(query: str = Query(...), k: int = Query(5)):
    try:
        settings = get_settings()
        index = get_faiss_index()
        with pg_conn() as conn:
            retriever = FaissRetriever(
                index=index,
                embed_model=settings.embed_model,
                pg_conn=conn,
            )
            hits = retriever.search(query, k=k or settings.top_k)
        answer = generate_answer(query, hits)
        return SearchResponse(query=query, hits=hits, answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 실패: {e}")
