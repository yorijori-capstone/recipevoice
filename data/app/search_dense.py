import os
import re
import sys

import faiss
import psycopg
from psycopg.rows import dict_row
from emb_local import LocalEmbedder

from data.app.config_loader import load_config

# 로그 줄이기
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

CFG = load_config("config.yaml")

DB_CFG     = CFG.get("database")
INDEX_PATH = CFG["paths"]["faiss_index_path"]
MODEL_NAME = CFG["embedding"]["model"]
TOP_K      = CFG["faiss"]["top_k"]

if not DB_CFG:
    raise RuntimeError("database configuration missing in config.yaml")

CONN_ARGS = {
    "dbname": DB_CFG.get("name"),
    "user": DB_CFG.get("user"),
    "password": DB_CFG.get("password"),
    "host": DB_CFG.get("host", "127.0.0.1"),
    "port": DB_CFG.get("port", 5432),
}
CONN_ARGS.update(DB_CFG.get("options") or {})

# 1) 쿼리 확보 (명령행 인자 > 인터랙티브 입력)
query = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else ""
if not query:
    query = input("검색어를 입력하세요: ").strip()

# 2) 키워드 추출
raw_terms = re.findall(r"[A-Za-z가-힣0-9]+", query)
terms = [t for t in raw_terms if len(t) >= 2]
expanded = set(terms)
for t in list(terms):
    if "미역국" in t:
        expanded.add("미역")
key_terms = list(expanded)

# 3) 리소스 로드
index = faiss.read_index(INDEX_PATH)
embedder = LocalEmbedder(MODEL_NAME)

# 4) FAISS 검색 (후보 넉넉히)
qv = embedder.encode([query])
TOP_CAND = max(TOP_K * 8, 50)
sims, ids = index.search(qv, TOP_CAND)
ids, sims = ids[0].tolist(), sims[0].tolist()

# 5) 후보 청크 메타 불러오기
rows = []
if ids:
    with psycopg.connect(row_factory=dict_row, **CONN_ARGS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    m.faiss_vector_id,
                    c.chunk_id,
                    c.text,
                    s.step_no,
                    r.recipe_id,
                    r.title,
                    r.author,
                    r.servings,
                    r.total_time,
                    r.difficulty
                FROM chunk_embedding_meta m
                JOIN chunk c ON c.chunk_id = m.chunk_id
                LEFT JOIN step s ON s.step_id = c.step_id
                LEFT JOIN recipe r ON r.recipe_id = c.recipe_id
                WHERE m.faiss_vector_id = ANY(%s)
                """,
                (ids,),
            )
            rows = cur.fetchall()

# 6) 프리필터: 키워드가 있으면 타이틀/본문 LIKE 매칭 우선
def matches_any(term_list, title, text):
    return any((k in (title or "")) or (k in (text or "")) for k in term_list)

if key_terms and rows:
    filtered = [r for r in rows if matches_any(key_terms, r["title"], r["text"])]
    if filtered:
        rows = filtered

# 7) 점수 재계산 (Dense + 보너스)
by_vid = {vid: sc for vid, sc in zip(ids, sims)}
scored = []
for r in rows:
    sc = float(by_vid.get(r["faiss_vector_id"], 0.0))
    bonus = 0.0
    if any(k in (r["title"] or "") for k in key_terms):
        bonus += 0.25
    if any(k in (r["text"] or "") for k in key_terms):
        bonus += 0.10
    scored.append((sc + bonus, r))

scored.sort(key=lambda x: x[0], reverse=True)

# 8) 출력
print("\n=== Top-K 결과 ===")
for rank, (sc, r) in enumerate(scored[:TOP_K], start=1):
    print(f"[{rank}] score={sc:.3f} | {r['title']}")
    meta_parts = []
    if r.get("author"):
        meta_parts.append(f"작성자: {r['author']}")
    if r.get("servings"):
        meta_parts.append(f"인분: {r['servings']}")
    if r.get("total_time"):
        meta_parts.append(f"조리시간: {r['total_time']}")
    if r.get("difficulty"):
        meta_parts.append(f"난이도: {r['difficulty']}")
    meta_str = " | ".join(meta_parts) if meta_parts else "(메타데이터 없음)"
    print("     ", meta_str)
