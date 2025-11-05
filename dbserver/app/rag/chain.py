from __future__ import annotations

from typing import List

from ..schemas.search import SearchHit


def generate_answer(query: str, hits: List[SearchHit]) -> str:
    # Simple rule-based summarizer: concatenate top sentences up to ~500 chars
    pieces: list[str] = []
    total = 0
    for h in hits:
        if not h.text:
            continue
        if total + len(h.text) > 500:
            remain = 500 - total
            if remain > 0:
                pieces.append(h.text[:remain])
                total += remain
            break
        pieces.append(h.text)
        total += len(h.text)
    # TODO: Replace with LangChain pipeline or LLM-based summarization
    return " ".join(pieces) if pieces else "질문과 관련된 정보를 찾지 못했습니다."
