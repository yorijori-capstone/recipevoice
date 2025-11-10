# data/app/ingest/db_bulk_seed.py
from __future__ import annotations

import os, glob, json, traceback, urllib.parse
from typing import Any, Dict, Iterable, List, Tuple, Optional

# 공통 유틸 (DB 연결/UPSERT 함수, ROOT/CFG 제공)
from data.app.ingest._upsert_utils import (
    get_conn,
    upsert_recipe,
    upsert_step,
    upsert_chunk,
    upsert_recipe_doc,
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
# 메타데이터 통합 청크 생성
# ------------------------------------------------------------
def create_metadata_chunk(
    cur,
    recipe_id: str,
    title: Optional[str],
    author: Optional[str],
    servings: Optional[str],
    total_time: Optional[str],
    difficulty: Optional[str],
) -> None:
    """
    레시피 메타데이터를 통합하여 하나의 chunk로 생성
    
    Args:
        cur: DB 커서
        recipe_id: 레시피 ID
        title: 레시피 제목
        author: 작성자
        servings: 인분
        total_time: 조리 시간
        difficulty: 난이도
    """
    parts = []
    if title:
        parts.append(f"레시피: {title}")
    if author:
        parts.append(f"작성자: {author}")
    if servings:
        parts.append(f"인분: {servings}")
    if total_time:
        parts.append(f"조리시간: {total_time}")
    if difficulty:
        parts.append(f"난이도: {difficulty}")
    
    if not parts:
        return  # 메타데이터가 없으면 청크 생성 안 함
    
    metadata_text = " | ".join(parts)
    
    upsert_chunk(
        cur=cur,
        chunk_id=None,
        recipe_id=recipe_id,
        step_id=None,
        step_no=None,
        section="metadata",
        text=metadata_text,
        meta_json=None,
    )


# ------------------------------------------------------------
# 재료별 청크 생성
# ------------------------------------------------------------
def create_ingredient_chunks(
    cur,
    recipe_id: str,
    obj: Dict[str, Any],
) -> None:
    """
    recipe_doc.raw_json의 ingredients_struct에서 재료를 추출하여
    각 재료별로 개별 chunk 생성
    
    Args:
        cur: DB 커서
        recipe_id: 레시피 ID
        obj: 레시피 JSON 객체
    """
    # ingredients_struct 우선 사용
    ingredients_struct = obj.get("ingredients_struct", [])
    
    if not ingredients_struct:
        # fallback: ingredients 배열 사용
        ingredients_list = obj.get("ingredients", [])
        if isinstance(ingredients_list, list):
            for ing in ingredients_list:
                if isinstance(ing, str):
                    # 문자열인 경우 첫 단어를 재료명으로 사용
                    name = ing.split()[0] if " " in ing else ing
                    if name.strip():
                        upsert_chunk(
                            cur=cur,
                            chunk_id=None,
                            recipe_id=recipe_id,
                            step_id=None,
                            step_no=None,
                            section="ingredients",
                            text=name.strip(),
                            meta_json=None,
                        )
        return
    
    # ingredients_struct 처리
    for item in ingredients_struct:
        if isinstance(item, dict):
            name = item.get("name", "").strip()
            if not name:
                continue
            
            # 재료명만 사용 (수량 정보는 제외)
            # 숫자, 단위, 설명 제거 (예: "소고기 국거리용 180g" -> "소고기")
            parts = name.split()
            if parts:
                base_name = parts[0]  # 첫 단어가 기본 재료명
                
                upsert_chunk(
                    cur=cur,
                    chunk_id=None,
                    recipe_id=recipe_id,
                    step_id=None,
                    step_no=None,
                    section="ingredients",
                    text=base_name,
                    meta_json=None,
                )
        elif isinstance(item, str):
            # 문자열인 경우 그대로 사용
            if item.strip():
                upsert_chunk(
                    cur=cur,
                    chunk_id=None,
                    recipe_id=recipe_id,
                    step_id=None,
                    step_no=None,
                    section="ingredients",
                    text=item.strip(),
                    meta_json=None,
                )


# ------------------------------------------------------------
# 메인 파이프라인
# ------------------------------------------------------------
def main() -> None:
    total = 0
    ok = 0
    skip = 0
    fail = 0

    with get_conn() as conn:
        cur = conn.cursor()

        for path, obj in iter_jsons(RAW_DIR):
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

                # 2) 메타데이터 통합 청크 생성
                create_metadata_chunk(
                    cur=cur,
                    recipe_id=recipe_id,
                    title=title,
                    author=author,
                    servings=servings,
                    total_time=total_time,
                    difficulty=difficulty,
                )

                # 3) 재료별 청크 생성
                create_ingredient_chunks(
                    cur=cur,
                    recipe_id=recipe_id,
                    obj=obj,
                )

                # 4) 원문 보존 (URL 포함)
                upsert_recipe_doc(
                    cur=cur,
                    recipe_id=recipe_id,
                    source_url=url,
                    raw_json=json.dumps(obj, ensure_ascii=False),
                )

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
    main()
