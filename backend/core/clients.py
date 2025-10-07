import os
from typing import List, Dict, Any
from voice.TTS.tts_player import generate_tts_audio

# --- Mock Implementations for RAG and Planning ---
MOCK_RECIPE_DB = {
    "6873683": {
        "title": "엄마의 레시피, 소고기 미역국 끓이는 법",
        "ingredients": "소고기,미역,쌀뜨물,다진마늘,참기름,국간장,소금"
    },
    "6912220": {
        "title": "순두부찌개. 바지락, 고기 없이도 기가 막힌 순두부찌개 만드는 법",
        "ingredients": "순두부,대파,양파,애호박,청양고추,달걀,참기름,식용유,고추가루,소금,설탕,굴소스,간장,다진 마늘,멸치육수"
    },
    "6883771": {
        "title": "돼지갈비찜 양념 황금레시피 갈비는 손으로 뜯어 먹어야 제맛!",
        "ingredients": "돼지갈비,감자,당근,대파,양조간장,설탕,올리고당,맛술,다진 마늘,후추,참기름"
    },
    "6983886": {
        "title": "치킨스튜 닭고기 프리카세(Fricassée) 쉽게 만드는 법",
        "ingredients": "닭,양파,표고버섯,버터,식용유,기름,맛술,케첩,간장,식초,설탕,소금,밀가루,우유,물,다진마늘,후추,파슬리가루,로즈마리"
    },
    "7002443": {
        "title": "쫄깃한 식감과 버터의 풍미가 느껴지는 닭고기스테이크",
        "ingredients": "닭다리살,소금,후추,바질가루,버터,올리브유,감자,아스파라거스,간장,올리고당,케찹"
    }
}

def search_rag(query: str) -> List[str]:
    """(Smarter Mock v2) Filters recipes by checking query in title OR ingredients."""
    print(f"--- MOCK RAG V2: Received search query: '{query}' ---")
    if not query:
        return []
    results = []
    query_lower = query.lower()
    for recipe_id, data in MOCK_RECIPE_DB.items():
        title_lower = data["title"].lower()
        ingredients_lower = data["ingredients"].lower()
        if query_lower in title_lower or query_lower in ingredients_lower:
            results.append(recipe_id)
    print(f"--- MOCK RAG V2: Found {len(results)} matching recipes: {results} ---")
    return results

def plan_recipe_for_voice(recipe_data: Dict[str, Any]) -> Dict[str, Any]:
    """(Mock) Generates a simple voice-friendly script from recipe data."""
    print(f"--- MOCK PLANNING: Planning recipe '{recipe_data.get('title')}' ---")
    planned_steps = []
    for step in recipe_data.get("steps", []):
        planned_steps.append({
            "order": step["order"],
            "script": f"{step['order']}번째 단계입니다. {step['instruction']}"
        })
    return {
        "title": recipe_data.get("title", ""),
        "opening_remark": f"좋아요, 지금부터 {recipe_data.get('title', '요리')} 만들기를 시작하겠습니다.",
        "planned_steps": planned_steps,
        "closing_remark": "이제 모든 요리가 끝났습니다. 맛있게 드세요! 안내를 종료할까요?"
    }

# --- Real TTS Implementation ---
def generate_speech(text: str) -> bytes:
    """Calls the actual TTS function from tts_player to generate speech."""
    print(f"--- Calling REAL TTS for: '{text[:30]}...' ---")
    try:
        return generate_tts_audio(text)
    except Exception as e:
        print(f"--- REAL TTS failed: {e} ---")
        # Fallback to silent audio in case of any error
        samplerate = 16000
        duration = 0.5
        header = b'RIFF' + (36).to_bytes(4, 'little') + b'WAVEfmt ' + (16).to_bytes(4, 'little') + (1).to_bytes(2, 'little') + (1).to_bytes(2, 'little') + samplerate.to_bytes(4, 'little') + (samplerate * 2).to_bytes(4, 'little') + (2).to_bytes(2, 'little') + (16).to_bytes(2, 'little') + b'data' + (int(samplerate*duration)*2).to_bytes(4, 'little')
        return header + (b'\x00' * int(samplerate*duration)*2)

# --- Mock STT Implementation ---
def recognize_speech(audio_data: bytes) -> str:
    """(Mock) Returns a fixed text command regardless of the audio input."""
    print(f"--- MOCK STT: Recognizing speech ({len(audio_data)} bytes) ---")
    return "다음"
