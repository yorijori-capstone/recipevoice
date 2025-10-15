# rag/retriever.py
import os
import re
import yaml
import faiss
import numpy as np
import sqlite3
from pathlib import Path
from typing import List

# data.app.emb_local을 직접 참조하기 위해 경로 설정
# 이 파일(retriever.py) 기준 3단계 상위 디렉토리(프로젝트 루트)를 sys.path에 추가
import sys
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data.app.emb_local import LocalEmbedder

# --- Global Variables & Resource Loading ---
# Load config once
try:
    with open(ROOT_DIR / "config.yaml", "r", encoding="utf-8") as f:
        CFG = yaml.safe_load(f)
    
    DB_PATH = ROOT_DIR / CFG["paths"]["sqlite_path"]
    INDEX_PATH = ROOT_DIR / CFG["paths"]["faiss_index_path"]
    MODEL_NAME = CFG["embedding"]["model"]
    TOP_K = CFG["faiss"]["top_k"]
    SCORE_THRESHOLD = CFG["faiss"].get("score_threshold", 0.45)

    # Load RAG resources (model and index) once on server startup
    print("--- [RAG] Loading FAISS index and embedding model... ---")
    INDEX = faiss.read_index(str(INDEX_PATH))
    EMBEDDER = LocalEmbedder(MODEL_NAME)
    print(f"--- [RAG] Resources loaded successfully. Score threshold set to {SCORE_THRESHOLD} ---")
    RAG_RESOURCES_LOADED = True
except Exception as e:
    print(f"--- [RAG] CRITICAL: Failed to load RAG resources: {e} ---")
    RAG_RESOURCES_LOADED = False
    # 리소스 로딩 실패 시 사용할 dummy 변수들
    INDEX = None
    EMBEDDER = None


def search_rag(query: str) -> List[str]:
    """
    FAISS와 SQLite를 사용하여 레시피를 검색하고, 키워드 필터링 및 점수 조정을 거쳐
    가장 관련성 높은 레시피 ID 목록을 순서대로 반환합니다.
    """
    if not RAG_RESOURCES_LOADED:
        # APIClientError 대신 일반 예외를 발생시키거나 빈 리스트를 반환할 수 있습니다.
        # 여기서는 서버 로그에 이미 오류가 출력되었으므로 빈 리스트를 반환합니다.
        print("[ERROR] RAG system is not available due to a resource loading error.")
        return []

    print(f"--- Performing RAG search for query: '{query}' ---")
    
    # 1. 키워드 추출
    raw_terms = re.findall(r"[A-Za-z가-힣0-9]+", query)
    key_terms = [t for t in raw_terms if len(t) >= 2]

    # 2. 쿼리 임베딩 및 FAISS 검색
    query_vector = EMBEDDER.encode([query])
    num_candidates = max(TOP_K * 8, 50)
    distances, vector_ids = INDEX.search(query_vector, num_candidates)
    
    vector_ids_list = vector_ids[0].tolist()
    distances_list = distances[0].tolist()
    if not vector_ids_list:
        return []

    # 3. DB에서 후보 청크 메타데이터 조회
    rows = []
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            placeholders = ",".join(["?"] * len(vector_ids_list))
            sql = f"""
                SELECT m.faiss_vector_id, c.text, r.recipe_id, r.title
                FROM chunk_embedding_meta m
                JOIN chunk c ON m.chunk_id = c.chunk_id
                JOIN recipe r ON r.recipe_id = c.recipe_id
                WHERE m.faiss_vector_id IN ({placeholders})
            """
            rows = conn.execute(sql, tuple(vector_ids_list)).fetchall()
    except sqlite3.Error as e:
        print(f"[ERROR] Database error during RAG search: {e}")
        return []

    # 4. 점수 재계산 (Dense + 키워드 보너스)
    scores_by_vid = {vid: score for vid, score in zip(vector_ids_list, distances_list)}
    scored_results = []
    for row in rows:
        base_score = float(scores_by_vid.get(row["faiss_vector_id"], 0.0))
        bonus = 0.0
        if any(k in (row["title"] or "") for k in key_terms):
            bonus += 0.25
        if any(k in (row["text"] or "") for k in key_terms):
            bonus += 0.10
        
        scored_results.append({
            "score": base_score + bonus,
            "recipe_id": row["recipe_id"]
        })

    # 5. 점수 기준으로 정렬
    scored_results.sort(key=lambda x: x['score'], reverse=True)

    # 6. 임계값 필터링 및 중복 없는 레시피 ID 목록 생성
    final_recipe_ids = []
    seen_recipe_ids = set()
    for result in scored_results:
        if result['score'] < SCORE_THRESHOLD:
            break
            
        recipe_id = result['recipe_id']
        if recipe_id not in seen_recipe_ids:
            final_recipe_ids.append(recipe_id)
            seen_recipe_ids.add(recipe_id)
            if len(final_recipe_ids) >= TOP_K:
                break
    
    print(f"--- RAG search found {len(final_recipe_ids)} recipes passing threshold {SCORE_THRESHOLD}. ---")
    return final_recipe_ids
