# data/app/services/store_finder.py
"""
레시피 재료 기반 매장 추천 서비스

레시피 DB의 재료 정보를 활용하여 Kakao Local API로 매장을 검색합니다.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.rows import dict_row
import requests

from data.app.config_loader import load_config

# 프로젝트 루트 기준 경로 계산
ROOT = Path(__file__).resolve().parents[2]
CFG_PATH = ROOT / "config.yaml"

CFG = load_config(CFG_PATH)

DB_CFG = CFG.get("database") or {}
if not DB_CFG:
    raise RuntimeError("database configuration missing in config.yaml")

DB_CONN_ARGS: Dict[str, Any] = {
    "dbname": DB_CFG.get("name"),
    "user": DB_CFG.get("user"),
    "password": DB_CFG.get("password"),
    "host": DB_CFG.get("host", "127.0.0.1"),
    "port": DB_CFG.get("port", 5432),
}
DB_CONN_ARGS.update(DB_CFG.get("options") or {})

KAKAO_API_KEY = CFG["kakao_api"]["rest_api_key"]
SEARCH_LIMIT = CFG["kakao_api"]["search_limit"]

# Kakao Local API 엔드포인트
KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 기본 위치 (서울특별시 마포구 백범로 35)
DEFAULT_LATITUDE = 37.5509442  # 위도
DEFAULT_LONGITUDE = 126.9410023  # 경도


# =========================
# 고기 관련 키워드 감지
# =========================
# 정확한 매칭용 (전체 단어)
MEAT_EXACT_KEYWORDS = [
    "소고기",
    "돼지고기",
    "닭고기",
    "오리고기",
    "양고기",
    "쇠고기",
    "삼겹살",
    "목살",
    "갈비",
]

# 부분 매칭용 (고기가 포함된 경우)
MEAT_PARTIAL_KEYWORDS = [
    "고기",
    "육류",
]

# 구매 불가능한 재료 필터링 (현재는 사용하지 않음, 향후 확장 대비)
EXCLUDED_INGREDIENTS = {
    "물",
    "소금",
    "설탕",
    "후추",
    "참기름",
    "식용유",
    "들기름",
    "국간장",
    "간장",
    "된장",
    "고추장",
    "마요네즈",
    "케첩",
    "식초",
    "미림",
    "맛술",
    "올리고당",
    "물엿",
    "꿀",
    "매실액",
    "다진마늘",
    "생강",
    "청주",
    "다시마",
    "멸치",
}


def get_db_connection() -> psycopg.Connection:
    """PostgreSQL 연결 반환."""
    return psycopg.connect(row_factory=dict_row, **DB_CONN_ARGS)


def extract_ingredients_from_recipe(recipe_id: str) -> List[str]:
    """
    recipe_doc.raw_json에서 ingredients_struct를 파싱하여 재료명 리스트 반환.
    """
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT raw_json FROM recipe_doc WHERE recipe_id = %s",
            (recipe_id,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")

    recipe_data = json.loads(row["raw_json"])

    ingredients_struct = recipe_data.get("ingredients_struct", [])
    if not ingredients_struct:
        ingredients_list = recipe_data.get("ingredients", [])
        ingredients_struct = [
            {"name": ing.split()[0] if " " in ing else ing, "qty": None}
            for ing in ingredients_list
        ]

    ingredient_names: List[str] = []
    for item in ingredients_struct:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        parts = name.split()
        if parts:
            ingredient_names.append(parts[0])

    return sorted(set(ingredient_names))


def is_meat_ingredient(ingredient: str) -> bool:
    """재료가 고기류인지 확인."""
    if ingredient == "소금":
        return False

    for keyword in MEAT_EXACT_KEYWORDS:
        if keyword == ingredient or keyword in ingredient:
            return True

    return any(keyword in ingredient for keyword in MEAT_PARTIAL_KEYWORDS)


def ingredient_to_search_keywords(ingredient: str) -> List[str]:
    """재료명을 검색 키워드로 변환."""
    keywords = ["마트", "슈퍼", "시장", "식재료"]
    if is_meat_ingredient(ingredient):
        keywords.extend(["정육", "육류"])
    return keywords


def search_stores_with_kakao(
    keyword: str,
    x: Optional[float] = None,
    y: Optional[float] = None,
    radius: int = 5000,
    retry_count: int = 2,
) -> List[Dict[str, Any]]:
    """Kakao Local API로 매장을 검색한다."""
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    params: Dict[str, Any] = {
        "query": keyword,
        "size": SEARCH_LIMIT * 2,
    }

    if x is not None and y is not None:
        params["x"] = x
        params["y"] = y
        params["radius"] = radius

    for attempt in range(retry_count + 1):
        try:
            response = requests.get(
                KAKAO_SEARCH_URL, headers=headers, params=params, timeout=10
            )
            if response.status_code == 200:
                documents = response.json().get("documents", [])
                stores: List[Dict[str, Any]] = []
                for doc in documents:
                    distance = doc.get("distance")
                    stores.append(
                        {
                            "store_name": doc.get("place_name", ""),
                            "address": doc.get("address_name", ""),
                            "lat": float(doc.get("y", 0)),
                            "lon": float(doc.get("x", 0)),
                            "distance": float(distance) if distance else None,
                            "search_keyword": keyword,
                        }
                    )

                if x is not None and y is not None:
                    stores.sort(
                        key=lambda s: s["distance"]
                        if s["distance"] is not None
                        else float("inf")
                    )
                return stores[:SEARCH_LIMIT]

            if response.status_code == 429 and attempt < retry_count:
                time.sleep(2**attempt)
                continue

            if response.status_code == 403:
                msg = (
                    response.json().get("message", "인증 오류")
                    if response.content
                    else "인증 오류"
                )
                print(f"[ERROR] API 인증 오류 (403): {msg}")
                print(f"  API 키 확인 필요: {KAKAO_API_KEY[:10]}...")
                return []

            try:
                msg = response.json().get("message", "")
            except Exception:
                msg = response.text[:100] if response.text else ""
            print(f"[WARN] API 오류 ({response.status_code}): {keyword} {msg}")
            return []

        except requests.exceptions.RequestException as exc:
            if attempt < retry_count:
                time.sleep(1)
                continue
            print(f"[ERROR] API 요청 실패: {keyword} - {exc}")
            return []

    return []


def find_stores_for_recipe(
    recipe_id: str,
    x: Optional[float] = None,
    y: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """레시피의 재료에 대해 매장 검색 및 요약."""
    print(f"\n[INFO] 레시피 ID: {recipe_id}")
    if x is not None and y is not None:
        print(f"[INFO] 위치 기반 검색: 위도 {y:.6f}, 경도 {x:.6f}")

    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT title FROM recipe WHERE recipe_id = %s", (recipe_id,))
        row = cur.fetchone()

    if not row:
        raise ValueError(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")

    recipe_title = row["title"]
    print(f"[INFO] 레시피명: {recipe_title}")

    try:
        ingredients = extract_ingredients_from_recipe(recipe_id)
        print(f"[INFO] 추출된 재료: {len(ingredients)}개 - {', '.join(ingredients)}")
    except Exception as exc:
        print(f"[ERROR] 재료 추출 실패: {exc}")
        return []

    if not ingredients:
        print("[WARN] 추출된 재료가 없습니다.")
        return []

    all_results: List[Dict[str, Any]] = []
    for idx, ingredient in enumerate(ingredients, start=1):
        print(f"\n[{idx}/{len(ingredients)}] 재료: {ingredient}")
        keywords = ingredient_to_search_keywords(ingredient)
        print(f"  검색 키워드: {', '.join(keywords)}")

        store_candidates: List[Dict[str, Any]] = []
        for keyword in keywords:
            stores = search_stores_with_kakao(keyword, x=x, y=y)
            if stores:
                store_candidates.extend(stores)
                print(f"  ✓ '{keyword}': {len(stores)}개 매장 발견")
            else:
                print(f"  ✗ '{keyword}': 검색 결과 없음")
            time.sleep(0.5)

        unique_stores: Dict[str, Dict[str, Any]] = {}
        for store in store_candidates:
            key = f"{store['store_name']}|{store['address']}"
            current = unique_stores.get(key)
            if current is None:
                unique_stores[key] = store
                continue
            dist = store.get("distance")
            if dist is not None and (
                current.get("distance") is None or dist < current["distance"]
            ):
                unique_stores[key] = store

        stores_list = list(unique_stores.values())
        stores_list.sort(
            key=lambda s: s.get("distance") if s.get("distance") is not None else float("inf")
        )

        selected = stores_list[:SEARCH_LIMIT]
        if selected:
            print(f"  → {len(selected)}개 매장 발견")
            all_results.append({"ingredient": ingredient, "stores": selected})
        else:
            print("  → 검색된 매장 없음")

    total_found = sum(len(entry["stores"]) for entry in all_results)
    print(f"\n[SUMMARY] 총 {total_found}개 매장 검색 완료")
    return all_results


def print_recommendations(recipe_id: str, results: List[Dict[str, Any]]) -> None:
    """매장 검색 결과를 콘솔에 출력."""
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT title FROM recipe WHERE recipe_id = %s", (recipe_id,))
        row = cur.fetchone()

    if not row:
        print(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")
        return

    recipe_title = row["title"]
    if not results:
        print(f"\n레시피명: {recipe_title}")
        print("추천 매장 정보가 없습니다.")
        return

    print("\n" + "=" * 60)
    print(f"레시피명: {recipe_title}")
    print("=" * 60)

    for result in results:
        ingredient = result["ingredient"]
        stores = result["stores"]
        print(f"\n재료: {ingredient}")
        print("  → 추천 매장 (가까운 순):")
        for idx, store in enumerate(stores, start=1):
            distance = store.get("distance")
            if distance is None:
                distance_info = ""
            elif distance < 1000:
                distance_info = f" ({distance:.0f}m)"
            else:
                distance_info = f" ({distance/1000:.1f}km)"
            print(f"    {idx}. {store['store_name']}, {store['address']}{distance_info}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("사용법: python store_finder.py <recipe_id> [위도] [경도]")
        print("예시: python store_finder.py 6873683")
        print("예시 (위치 지정): python store_finder.py 6873683 37.5665 126.9780")
        print("\n위치 정보는 선택사항입니다. 위치를 지정하면 가까운 매장을 우선 정렬합니다.")
        sys.exit(1)

    recipe_id = sys.argv[1]
    y = DEFAULT_LATITUDE
    x = DEFAULT_LONGITUDE

    if len(sys.argv) >= 4:
        try:
            y = float(sys.argv[2])
            x = float(sys.argv[3])
            print(f"[INFO] 위치 지정됨: 위도 {y}, 경도 {x}")
        except ValueError:
            print("[WARN] 위치 정보 형식 오류. 숫자로 입력해주세요.")
            print("예시: python store_finder.py 6873683 37.5665 126.9780")
            sys.exit(1)
    else:
        print("[INFO] 기본 위치 사용: 서울특별시 마포구 백범로 35")
        print(f"[INFO] 위도 {y}, 경도 {x}")

    try:
        results = find_stores_for_recipe(recipe_id, x=x, y=y)
        print_recommendations(recipe_id, results)
    except Exception as exc:
        print(f"[ERROR] 실행 중 오류 발생: {exc}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
