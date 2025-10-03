import os
from typing import List, Dict, Any

# --- Mock Implementations ---
# When the real servers are ready, you can switch back to the original request-based functions.

def search_rag(query: str) -> List[str]:
    """(Mock) Returns a fixed list of recipe IDs for any query."""
    print(f"--- MOCK RAG: Searching for '{query}' ---")
    # Return hardcoded recipe IDs that are known to be in the test data.
    return ["6873683", "6883771", "6912220", "6983886", "7002443"]

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

def generate_speech(text: str) -> bytes:
    """(Mock) Returns a pre-existing test WAV file instead of generating speech."""
    print(f"--- MOCK TTS: Generating speech for '{text[:30]}...' ---")
    try:
        # Use an existing short audio file for testing playback.
        with open('voice/test/다음.wav', 'rb') as f:
            return f.read()
    except FileNotFoundError:
        print("--- MOCK TTS: Test file not found, returning silent audio. ---")
        # Fallback to a silent WAV header if the file doesn't exist
        # Header for a 0.5-sec, 16-bit, 16kHz mono WAV file
        samplerate = 16000
        duration = 0.5
        channels = 1
        bits_per_sample = 16
        num_samples = int(samplerate * duration)
        data_size = num_samples * channels * (bits_per_sample // 8)
        chunk_size = 36 + data_size
        header = b'RIFF' + chunk_size.to_bytes(4, 'little') + b'WAVEfmt ' + (16).to_bytes(4, 'little') + (1).to_bytes(2, 'little') + channels.to_bytes(2, 'little') + samplerate.to_bytes(4, 'little') + (samplerate * channels * (bits_per_sample // 8)).to_bytes(4, 'little') + (channels * (bits_per_sample // 8)).to_bytes(2, 'little') + bits_per_sample.to_bytes(2, 'little') + b'data' + data_size.to_bytes(4, 'little')
        return header + (b'\x00' * data_size)

def recognize_speech(audio_data: bytes) -> str:
    """(Mock) Returns a fixed text command regardless of the audio input."""
    print(f"--- MOCK STT: Recognizing speech ({len(audio_data)} bytes) ---")
    # In a real scenario, you'd send this to the STT server.
    # For testing, we can cycle through commands or return a fixed one.
    return "다음"


# --- Real Implementations (for when servers are ready) ---
# You can uncomment these and comment out the mock functions above.

# import requests

# RAG_SERVER_URL = os.getenv("RAG_SERVER_URL", "http://localhost:8001")
# VOICE_SERVER_URL = os.getenv("VOICE_SERVER_URL", "http://localhost:8002")
# PLANNING_SERVER_URL = os.getenv("PLANNING_SERVER_URL", "http://localhost:8003")

# class APIClientError(Exception):
#     """API 클라이언트에서 발생하는 오류를 위한 커스텀 예외 클래스"""
#     def __init__(self, message, status_code=None):
#         super().__init__(message)
#         self.status_code = status_code

# def search_rag(query: str) -> List[str]:
#     """RAG 서버를 호출하여 검색어에 맞는 레시피 ID 목록을 반환합니다."""
#     try:
#         response = requests.get(f"{RAG_SERVER_URL}/search", params={'q': query}, timeout=10)
#         response.raise_for_status()
#         return response.json().get("recipe_ids", [])
#     except requests.exceptions.RequestException as e:
#         raise APIClientError(f"RAG 서버 연결 오류: {e}") from e

# def plan_recipe_for_voice(recipe_data: Dict[str, Any]) -> Dict[str, Any]:
#     """플래닝(LLM) 서버를 호출하여 음성 안내에 적합한 레시피 구조를 받습니다."""
#     try:
#         response = requests.post(f"{PLANNING_SERVER_URL}/plan", json=recipe_data, timeout=30)
#         response.raise_for_status()
#         return response.json()
#     except requests.exceptions.RequestException as e:
#         raise APIClientError(f"플래닝 서버 연결 오류: {e}") from e

# def generate_speech(text: str) -> bytes:
#     """음성(TTS) 서버를 호출하여 텍스트를 음성 데이터로 변환합니다."""
#     try:
#         response = requests.post(f"{VOICE_SERVER_URL}/tts", json={'text': text}, timeout=15)
#         response.raise_for_status()
#         return response.content
#     except requests.exceptions.RequestException as e:
#         raise APIClientError(f"음성(TTS) 서버 연결 오류: {e}") from e

# def recognize_speech(audio_data: bytes) -> str:
#     """음성(STT) 서버를 호출하여 음성을 텍스트로 변환합니다."""
#     try:
#         files = {'audio': audio_data}
#         response = requests.post(f"{VOICE_SERVER_URL}/stt", files=files, timeout=15)
#         response.raise_for_status()
#         return response.json().get("text", "")
#     except requests.exceptions.RequestException as e:
#         raise APIClientError(f"음성(STT) 서버 연결 오류: {e}") from e
