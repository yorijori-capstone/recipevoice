# data/app/ingest/db_bulk_seed.py
from __future__ import annotations

import os, glob, json, traceback, urllib.parse
import sys
from typing import Any, Dict, Iterable, List, Tuple, Optional

# Add backend to sys.path to import clients
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(os.path.join(ROOT, "backend"))
from core import clients

# 공통 유틸 (DB 연결/UPSERT 함수, ROOT/CFG 제공)
from data.app.ingest._upsert_utils import (
    get_conn,
    upsert_recipe,
    upsert_step,
    upsert_chunk,
    upsert_recipe_doc,
    upsert_voice_plan,
    ROOT,
    CFG,
)

# ------------------------------------------------------------
# 경로 설정: config.yaml 기준 (raw_data_dir)
# ------------------------------------------------------------
RAW_DIR = os.path.normpath(os.path.join(ROOT, CFG["paths"]["raw_data_dir"]))
print("[DEBUG] RAW_DIR =", RAW_DIR)


# ------------------------------------------------------------
# 유틸: JSON 로더(안전)
# ------------------------------------------------------------
def iter_jsons(folder: str) -> Iterable[Tuple[str, Dict[str, Any]]]:
    """
    폴더 내 *.json 파일을 순회하며 (path, obj)을 yield.
    파싱 실패 시 [SKIP] 로그 출력 후 계속 진행.
    """
    pattern = os.path.join(folder, "*.json")
    paths = sorted(glob.glob(pattern))
    if not paths:
        print(f"[WARN] No JSON files found: {pattern}")
    for p in paths:
        try:
            with open(p, "r", encoding="utf-8") as f:
                yield p, json.load(f)
        except Exception as e:
            print(f"[SKIP] {os.path.basename(p)}: {e}")


# ------------------------------------------------------------
# 스텝 정규화: 문자열/딕셔너리/혼합 모두 지원
# 출력 형식: [{"no": int, "text": str, ...}, ...]
# ------------------------------------------------------------
def normalize_steps(obj: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw_steps = obj.get("steps") or obj.get("instructions") or []

    norm_steps: List[Dict[str, Any]] = []
    if isinstance(raw_steps, str):
        lines = [s for s in raw_steps.splitlines() if s.strip()]
        for i, line in enumerate(lines, start=1):
            norm_steps.append({"no": i, "text": line.strip()})
    elif isinstance(raw_steps, list):
        for i, st in enumerate(raw_steps, start=1):
            if isinstance(st, str):
                norm_steps.append({"no": i, "text": st.strip()})
            elif isinstance(st, dict):
                step_no = (
                    st.get("no")
                    or st.get("step_no")
                    or st.get("step")
                    or st.get("index")
                    or i
                )
                text = st.get("text") or st.get("instruction") or st.get("desc") or ""
                norm_steps.append(
                    {
                        "no": int(step_no),
                        "text": text.strip(),
                        "time_hint_sec": st.get("time_hint_sec"),
                        "tools_json": st.get("tools_json"),
                        "warnings_json": st.get("warnings_json"),
                        "meta_json": st.get("meta_json"),
                        "step_id": st.get("step_id"),
                        "chunk_id": st.get("chunk_id"),
                    }
                )
            else:
                # 알 수 없는 타입은 문자열로 보존
                norm_steps.append({"no": i, "text": str(st)})
    else:
        # 예상치 못한 타입
        pass

    if norm_steps:
        print(f"[DEBUG] normalized steps: {len(norm_steps)}; sample: {norm_steps[:2]}")
    return norm_steps


# ------------------------------------------------------------
# (선택) 부가 섹션 정규화 예시: ingredients / tips
# section_name: "ingredients" | "tips" ...
# 각 요소가 str/dict 섞여 있어도 텍스트만 추출하여 chunk로 저장
# ------------------------------------------------------------
def normalize_section_lines(obj: Dict[str, Any], section_name: str) -> List[str]:
    raw = obj.get(section_name) or []
    lines: List[str] = []
    if isinstance(raw, str):
        lines = [s.strip() for s in raw.splitlines() if s.strip()]
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                if item.strip():
                    lines.append(item.strip())
            elif isinstance(item, dict):
                # 대표 텍스트 키들 탐색
                txt = item.get("text") or item.get("name") or item.get("desc") or ""
                if txt and txt.strip():
                    lines.append(txt.strip())
            else:
                # 기타 타입은 문자열화
                s = str(item).strip()
                if s:
                    lines.append(s)
    return lines

# URL → 소스명 변환 함수
def guess_source_from_url(url: Optional[str]) -> str:
    if not url:
        return "web"
    netloc = urllib.parse.urlparse(url).netloc.lower()
    if "10000recipe" in netloc:
        return "10000recipe"
    return netloc or "web"


# ------------------------------------------------------------
# 메인 파이프라인
# ------------------------------------------------------------
import argparse

def main(limit: Optional[int] = None) -> None:
    total = 0
    ok = 0
    skip = 0
    fail = 0

    with get_conn() as conn:
        cur = conn.cursor()

        for path, obj in iter_jsons(RAW_DIR):
            if limit is not None and ok >= limit:
                print(f"\n[INFO] Reached limit of {limit} recipes. Stopping.")
                break

            total += 1
            try:
                title = obj.get("title") or os.path.basename(path)
                url = obj.get("source_url")
                source = obj.get("source") or guess_source_from_url(url)
                rid = obj.get("recipe_id")
                external_id = obj.get("external_id") or obj.get("id") or rid
                external_id = str(external_id) if external_id is not None else None
                author = obj.get("copyright")
                servings = obj.get("servings")
                total_time = obj.get("cook_time")
                difficulty = obj.get("difficulty")

                print(f"[LOAD] {os.path.basename(path)} | title={title}")

                # 1) recipe UPSERT (url은 recipe_doc에 보관)
                recipe_id = upsert_recipe(
                    cur=cur,
                    recipe_id=rid,
                    title=title,
                    source=source,
                    external_id=external_id,
                    author=author,
                    servings=servings,
                    total_time=total_time,
                    difficulty=difficulty
                )

                # 2) steps → step/chunk UPSERT
                norm_steps = normalize_steps(obj)
                for st in norm_steps:
                    step_no = st.get("no")
                    text = st.get("text") or ""

                    step_id = upsert_step(
                        cur=cur,
                        step_id=st.get("step_id"),
                        recipe_id=recipe_id,
                        step_no=int(step_no) if step_no is not None else None,
                        text=text,
                        time_hint_sec=st.get("time_hint_sec"),
                        tools_json=st.get("tools_json"),
                        warnings_json=st.get("warnings_json"),
                        meta_json=st.get("meta_json"),
                    )

                    upsert_chunk(
                        cur=cur,
                        chunk_id=st.get("chunk_id"),
                        recipe_id=recipe_id,
                        step_id=step_id,
                        step_no=int(step_no) if step_no is not None else None,
                        section="step",
                        text=text,
                        meta_json=None,
                    )

                # 3) (선택) 다른 섹션도 chunk로 저장하고 싶다면 주석 해제
                for line in normalize_section_lines(obj, "ingredients"):
                    upsert_chunk(
                        cur=cur,
                        chunk_id=None,
                        recipe_id=recipe_id,
                        step_id=None,
                        step_no=None,
                        section="ingredients",
                        text=line,
                        meta_json=None,
                    )

                for line in normalize_section_lines(obj, "tips"):
                    upsert_chunk(
                        cur=cur,
                        chunk_id=None,
                        recipe_id=recipe_id,
                        step_id=None,
                        step_no=None,
                        section="tips",
                        text=line,
                        meta_json=None,
                    )

                # 4) 원문 보존 (URL 포함)
                upsert_recipe_doc(
                    cur=cur,
                    recipe_id=recipe_id,
                    source_url=url,
                    raw_json=json.dumps(obj, ensure_ascii=False),
                )

                # 5) Voice Planning (LLM)
                try:
                    print(f"[PLAN] Generating voice plan for {title}...")
                    
                    # Format ingredients
                    ingredients_payload = []
                    if "ingredients_struct" in obj:
                        for item in obj["ingredients_struct"]:
                            ingredients_payload.append({
                                "name": item.get("name", ""),
                                "quantity": item.get("qty", "")
                            })
                    else:
                        # Fallback: use string list
                        # normalize_section_lines returns list of strings
                        ing_lines = normalize_section_lines(obj, "ingredients")
                        for item in ing_lines:
                            ingredients_payload.append({
                                "name": item,
                                "quantity": ""
                            })

                    # Format steps
                    # norm_steps has {"no": int, "text": str, ...}
                    steps_payload = []
                    for st in norm_steps:
                        steps_payload.append({
                            "order": st.get("no", 0),
                            "instruction": st.get("text", "")
                        })
                    
                    recipe_data_for_plan = {
                        "title": title,
                        "ingredients": ingredients_payload,
                        "steps": steps_payload
                    }
                    
                    plan_result = clients.plan_recipe_for_voice(recipe_data_for_plan)
                    upsert_voice_plan(
                        cur=cur,
                        recipe_id=recipe_id,
                        plan_json=json.dumps(plan_result, ensure_ascii=False)
                    )
                    print(f"[PLAN] Saved voice plan for {recipe_id}")
                except Exception as plan_exc:
                    print(f"[WARN] Voice planning failed for {title}: {plan_exc}")
                    # Do not fail the whole ingestion, just log warning

                conn.commit()
                ok += 1
                print(f"[OK] {title} -> {recipe_id}")

            except Exception as e:
                fail += 1
                conn.rollback()
                print(f"[FAIL] {os.path.basename(path)}: {e}")
                traceback.print_exc()

        print(f"\n[SUMMARY] total={total}, ok={ok}, fail={fail}, skip={skip}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk ingest recipes to DB")
    parser.add_argument("--limit", type=int, help="Limit the number of recipes to ingest", default=None)
    args = parser.parse_args()
    main(limit=args.limit)
