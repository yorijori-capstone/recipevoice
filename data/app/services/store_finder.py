# data/app/services/store_finder.py
"""
레시피 재료 기반 매장 추천 서비스

레시피 DB의 재료 정보를 활용하여 Kakao Local API로 매장을 검색하고,
결과를 DB에 저장하여 추천 시스템을 구축합니다.
"""
from __future__ import annotations

import os
import json
import time
import sqlite3
import yaml
import requests
from typing import List, Dict, Optional, Any
from pathlib import Path

# 프로젝트 루트 기준 경로 계산
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
CFG_PATH = os.path.join(ROOT, "config.yaml")

with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

DB_PATH = os.path.join(ROOT, CFG["paths"]["sqlite_path"])
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
    "소고기", "돼지고기", "닭고기", "오리고기", "양고기",
    "쇠고기", "삼겹살", "목살", "갈비"
]

# 부분 매칭용 (고기가 포함된 경우)
MEAT_PARTIAL_KEYWORDS = [
    "고기", "육류"
]

# 구매 불가능한 재료 필터링
EXCLUDED_INGREDIENTS = {
    "물", "소금", "설탕", "후추", "참기름", "식용유", "들기름", 
    "국간장", "간장", "된장", "고추장", "마요네즈", "케첩",
    "식초", "미림", "맛술", "올리고당", "물엿", "꿀", "매실액",
    "다진마늘", "생강", "청주", "맛술", "다시마", "멸치"
}


# =========================
# 유틸리티 함수
# =========================
def get_db_connection() -> sqlite3.Connection:
    """DB 연결 반환"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def extract_ingredients_from_recipe(recipe_id: str) -> List[str]:
    """
    recipe_doc.raw_json에서 ingredients_struct를 파싱하여 재료명 리스트 반환
    
    Args:
        recipe_id: 레시피 ID
        
    Returns:
        재료명 리스트 (정제된 순수 재료명만)
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT raw_json FROM recipe_doc WHERE recipe_id = ?",
            (recipe_id,)
        )
        row = cur.fetchone()
        
        if not row:
            raise ValueError(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")
        
        raw_json_str = row["raw_json"]
        recipe_data = json.loads(raw_json_str)
        
        ingredients_struct = recipe_data.get("ingredients_struct", [])
        if not ingredients_struct:
            # fallback: ingredients 배열 사용
            ingredients_list = recipe_data.get("ingredients", [])
            ingredients_struct = [
                {"name": ing.split()[0] if " " in ing else ing, "qty": None}
                for ing in ingredients_list
            ]
        
        # 재료명 추출 및 정제
        ingredient_names = []
        for item in ingredients_struct:
            name = item.get("name", "").strip()
            if not name:
                continue
            
            # 숫자, 단위, 설명 제거 (예: "소고기 국거리용 180g" -> "소고기")
            parts = name.split()
            if parts:
                base_name = parts[0]  # 첫 단어가 기본 재료명
                
                # 재료 필터링 제거: 모든 재료 검색
                ingredient_names.append(base_name)
        
        return list(set(ingredient_names))  # 중복 제거


def is_meat_ingredient(ingredient: str) -> bool:
    """
    재료가 고기류인지 확인
    
    Args:
        ingredient: 재료명
        
    Returns:
        고기류이면 True
    """
    # 예외 처리: 소금은 고기가 아님
    if ingredient == "소금":
        return False
    
    # 정확한 매칭 우선 (전체 단어 일치)
    for keyword in MEAT_EXACT_KEYWORDS:
        if keyword == ingredient:
            return True
        # 키워드가 재료명에 포함된 경우
        if keyword in ingredient:
            return True
    
    # 부분 매칭 (고기, 육류가 포함된 경우)
    for keyword in MEAT_PARTIAL_KEYWORDS:
        if keyword in ingredient:
            return True
    
    return False


def ingredient_to_search_keywords(ingredient: str) -> List[str]:
    """
    재료명을 검색 키워드로 변환 (robust한 검색 전략)
    
    모든 재료에 대해 기본적으로 "마트", "슈퍼", "시장", "식재료" 키워드 사용
    고기인 경우 추가로 "정육", "육류" 키워드 사용
    (재료명은 키워드에 포함하지 않음)
    
    Args:
        ingredient: 재료명 (예: "소고기")
        
    Returns:
        검색 키워드 리스트
    """
    # 기본 키워드: 모든 재료에 대해 마트/슈퍼/시장/식재료 검색 (재료명 제외)
    base_keywords = ["마트", "슈퍼", "시장", "식재료"]
    keywords = base_keywords.copy()
    
    # 고기인 경우 정육 관련 키워드 추가
    if is_meat_ingredient(ingredient):
        meat_keywords = ["정육", "육류"]
        keywords.extend(meat_keywords)
    
    return keywords


def search_stores_with_kakao(keyword: str, x: Optional[float] = None, y: Optional[float] = None, radius: int = 5000, retry_count: int = 2) -> List[Dict[str, Any]]:
    """
    Kakao Local API로 매장 검색 (위치 기반, 가까운 순 정렬)
    
    Args:
        keyword: 검색 키워드
        x: 경도 (longitude) - 선택사항
        y: 위도 (latitude) - 선택사항
        radius: 검색 반경(미터), 기본값 5000m
        retry_count: 최대 재시도 횟수
        
    Returns:
        매장 정보 리스트 (가까운 순 정렬)
    """
    headers = {
        "Authorization": f"KakaoAK {KAKAO_API_KEY}"
    }
    
    params = {
        "query": keyword,
        "size": SEARCH_LIMIT * 2  # 더 많이 받아서 정렬 후 상위 선택
    }
    
    # 위치 기반 검색 (가까운 순 정렬)
    if x is not None and y is not None:
        params["x"] = x
        params["y"] = y
        params["radius"] = radius
    
    for attempt in range(retry_count + 1):
        try:
            response = requests.get(KAKAO_SEARCH_URL, headers=headers, params=params, timeout=10)
            
            # API 오류 처리
            if response.status_code == 429:
                if attempt < retry_count:
                    time.sleep(2 ** attempt)  # 지수 백오프
                    continue
                else:
                    print(f"[WARN] API 요청 한도 초과: {keyword}")
                    return []
            
            if response.status_code == 403:
                error_msg = response.json().get("message", "인증 오류") if response.content else "인증 오류"
                print(f"[ERROR] API 인증 오류 (403): {error_msg}")
                print(f"  API 키 확인 필요: {KAKAO_API_KEY[:10]}...")
                return []
            
            if response.status_code != 200:
                error_msg = ""
                try:
                    error_data = response.json()
                    error_msg = error_data.get("message", "")
                except:
                    error_msg = response.text[:100] if response.text else ""
                print(f"[WARN] API 오류 ({response.status_code}): {keyword}")
                if error_msg:
                    print(f"  오류 메시지: {error_msg}")
                return []
            
            data = response.json()
            documents = data.get("documents", [])
            
            stores = []
            for doc in documents:
                # 거리 정보가 있으면 포함
                distance = doc.get("distance")
                stores.append({
                    "store_name": doc.get("place_name", ""),
                    "address": doc.get("address_name", ""),
                    "lat": float(doc.get("y", 0)),
                    "lon": float(doc.get("x", 0)),
                    "distance": float(distance) if distance else None,
                    "search_keyword": keyword
                })
            
            # 거리 기준으로 정렬 (가까운 순)
            if x is not None and y is not None:
                stores.sort(key=lambda s: s["distance"] if s["distance"] is not None else float('inf'))
            else:
                # 거리 정보가 없으면 문서 순서대로 (API가 이미 정렬해서 반환)
                pass
            
            return stores[:SEARCH_LIMIT]  # 상위 N개만 반환
            
        except requests.exceptions.RequestException as e:
            if attempt < retry_count:
                time.sleep(1)
                continue
            else:
                print(f"[ERROR] API 요청 실패: {keyword} - {e}")
                return []
    
    return []


def find_stores_for_recipe(recipe_id: str, x: Optional[float] = None, y: Optional[float] = None) -> List[Dict[str, Any]]:
    """
    레시피의 재료에 대해 매장 검색 및 출력
    
    Args:
        recipe_id: 레시피 ID
        x: 경도 (longitude) - 선택사항, 위치 기반 검색 시 사용
        y: 위도 (latitude) - 선택사항, 위치 기반 검색 시 사용
        
    Returns:
        전체 검색 결과 요약
    """
    print(f"\n[INFO] 레시피 ID: {recipe_id}")
    if x is not None and y is not None:
        print(f"[INFO] 위치 기반 검색: 위도 {y:.6f}, 경도 {x:.6f}")
    
    # 1. 레시피 제목 확인
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT title FROM recipe WHERE recipe_id = ?", (recipe_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")
        recipe_title = row["title"]
    
    print(f"[INFO] 레시피명: {recipe_title}")
    
    # 2. 재료 추출
    try:
        ingredients = extract_ingredients_from_recipe(recipe_id)
        print(f"[INFO] 추출된 재료: {len(ingredients)}개 - {', '.join(ingredients)}")
    except Exception as e:
        print(f"[ERROR] 재료 추출 실패: {e}")
        return []
    
    if not ingredients:
        print("[WARN] 추출된 재료가 없습니다.")
        return []
    
    # 3. 각 재료별 매장 검색
    all_results = []
    
    for idx, ingredient in enumerate(ingredients, 1):
        print(f"\n[{idx}/{len(ingredients)}] 재료: {ingredient}")
        
        # 키워드 변환
        keywords = ingredient_to_search_keywords(ingredient)
        print(f"  검색 키워드: {', '.join(keywords)}")
        
        # 각 키워드로 검색 (위치 정보 전달)
        all_stores = []
        for keyword in keywords:
            stores = search_stores_with_kakao(keyword, x=x, y=y)
            if stores:
                all_stores.extend(stores)
                print(f"  ✓ '{keyword}': {len(stores)}개 매장 발견")
            else:
                print(f"  ✗ '{keyword}': 검색 결과 없음")
            
            time.sleep(0.5)  # API 호출 간격
        
        # 중복 제거 (매장명+주소 기준) 및 거리 기준 정렬
        unique_stores = {}
        for store in all_stores:
            # 매장명과 주소 조합으로 고유성 판단
            key = f"{store['store_name']}|{store['address']}"
            if key not in unique_stores:
                unique_stores[key] = store
            else:
                # 이미 있으면 거리가 더 가까운 것으로 업데이트
                existing = unique_stores[key]
                if store.get("distance") is not None:
                    if existing.get("distance") is None or store["distance"] < existing["distance"]:
                        unique_stores[key] = store
        
        # 거리 기준으로 정렬 (가까운 순)
        stores_list = list(unique_stores.values())
        stores_list.sort(key=lambda s: s.get("distance") if s.get("distance") is not None else float('inf'))
        
        stores_to_display = stores_list[:SEARCH_LIMIT]  # 상위 N개만
        
        if stores_to_display:
            print(f"  → {len(stores_to_display)}개 매장 발견")
            all_results.append({
                "ingredient": ingredient,
                "stores": stores_to_display
            })
        else:
            print(f"  → 검색된 매장 없음")
    
    # 4. 결과 요약 출력
    total_found = sum(len(r["stores"]) for r in all_results)
    print(f"\n[SUMMARY] 총 {total_found}개 매장 검색 완료")
    
    return all_results


def print_recommendations(recipe_id: str, results: List[Dict[str, Any]]):
    """
    매장 검색 결과를 콘솔에 출력
    
    Args:
        recipe_id: 레시피 ID
        results: 검색 결과 리스트
    """
    # 레시피 정보
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT title FROM recipe WHERE recipe_id = ?", (recipe_id,))
        row = cur.fetchone()
        if not row:
            print(f"레시피 ID '{recipe_id}'를 찾을 수 없습니다.")
            return
        recipe_title = row["title"]
    
    if not results:
        print(f"\n레시피명: {recipe_title}")
        print("추천 매장 정보가 없습니다.")
        return
    
    # 출력
    print(f"\n{'='*60}")
    print(f"레시피명: {recipe_title}")
    print(f"{'='*60}")
    
    for result in results:
        ingredient = result["ingredient"]
        stores = result["stores"]
        
        print(f"\n재료: {ingredient}")
        print(f"  → 추천 매장 (가까운 순):")
        for idx, store in enumerate(stores, 1):
            distance_info = ""
            if store.get('distance') is not None:
                distance_m = store['distance']
                if distance_m < 1000:
                    distance_info = f" ({distance_m:.0f}m)"
                else:
                    distance_info = f" ({distance_m/1000:.1f}km)"
            print(f"    {idx}. {store['store_name']}, {store['address']}{distance_info}")
    
    print(f"\n{'='*60}")


# =========================
# 메인 실행
# =========================
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("사용법: python store_finder.py <recipe_id> [위도] [경도]")
        print("예시: python store_finder.py 6873683")
        print("예시 (위치 지정): python store_finder.py 6873683 37.5665 126.9780")
        print("\n위치 정보는 선택사항입니다. 위치를 지정하면 가까운 매장을 우선 정렬합니다.")
        sys.exit(1)
    
    recipe_id = sys.argv[1]
    
    # 위치 정보 파싱 (선택사항)
    # 기본값: 서울특별시 마포구 백범로 35
    x = DEFAULT_LONGITUDE  # 경도
    y = DEFAULT_LATITUDE   # 위도
    
    if len(sys.argv) >= 4:
        try:
            y = float(sys.argv[2])  # 위도
            x = float(sys.argv[3])  # 경도
            print(f"[INFO] 위치 지정됨: 위도 {y}, 경도 {x}")
        except ValueError:
            print("[WARN] 위치 정보 형식 오류. 숫자로 입력해주세요.")
            print("예시: python store_finder.py 6873683 37.5665 126.9780")
            sys.exit(1)
    else:
        print(f"[INFO] 기본 위치 사용: 서울특별시 마포구 백범로 35")
        print(f"[INFO] 위도 {y}, 경도 {x}")
    
    try:
        # 매장 검색
        results = find_stores_for_recipe(recipe_id, x=x, y=y)
        
        # 결과 출력
        print_recommendations(recipe_id, results)
        
    except Exception as e:
        print(f"[ERROR] 실행 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

