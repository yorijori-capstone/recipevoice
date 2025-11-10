# backend/core/clients.py
import os
import requests
import base64
from typing import Dict, Any

# --- RAG & Voice Imports ---
from pathlib import Path
from voice.tts_service import generate_tts_audio
from voice.stt_service import recognize_speech_from_audio
from rag.search import search_rag  # RAG 모듈에서 검색 함수를 직접 import

# --- Exception Class ---
class APIClientError(Exception):
    """API 클라이언트에서 발생하는 모든 예외에 대한 기본 클래스"""
    pass

# --- Global Variables ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# --- LLM Planning Server (FastAPI) --- 
LLM_SERVER_URL = os.getenv("PLANNING_SERVER_URL", "http://localhost:8100")

def plan_recipe_for_voice(recipe_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM 플래닝 서버(/plan)를 호출하여 레시피에 대한 음성 안내 스크립트를 생성합니다.
    """
    print(f"--- Calling LLM Planning Server ({LLM_SERVER_URL}/plan) for recipe: '{recipe_data.get('title')}' ---")
    try:
        response = requests.post(f"{LLM_SERVER_URL}/plan", json=recipe_data, timeout=300) # 타임아웃을 5분으로 연장
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise APIClientError(f"LLM 플래닝 서버 연결 실패: {e}")
    except Exception as e:
        raise APIClientError(f"플래닝 데이터 처리 중 예기치 않은 오류 발생: {e}")

def handle_control_command(command: str, current_step_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM 플래닝 서버(/control)를 호출하여 '멈춰', '다시' 등의 제어 명령을 처리합니다.
    """
    payload = {
        "command": command,
        "current_step_order": current_step_data.get("order"),
        "current_step": current_step_data
    }
    try:
        response = requests.post(f"{LLM_SERVER_URL}/control", json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise APIClientError(f"LLM 제어 서버 연결 실패: {e}")
    except Exception as e:
        raise APIClientError(f"제어 명령 처리 중 예기치 않은 오류 발생: {e}")

def chat_with_llm(user_input: str, chat_history: str) -> Dict[str, Any]:
    """
    LLM 플래닝 서버(/chat)를 호출하여 일반적인 사용자 대화를 처리합니다.
    """
    payload = {
        "input": user_input,
        "chat_history": chat_history
    }
    print(f"--- Calling LLM Chat Server ({LLM_SERVER_URL}/chat) with input: '{user_input}' ---")
    try:
        response = requests.post(f"{LLM_SERVER_URL}/chat", json=payload, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise APIClientError(f"LLM 챗 서버 연결 실패: {e}")
    except Exception as e:
        raise APIClientError(f"챗 응답 처리 중 예기치 않은 오류 발생: {e}")

# --- STT & TTS Functions ---
def recognize_speech(audio_data: bytes) -> str:
    """실제 STT 함수를 호출하여 음성 데이터를 텍스트로 변환합니다."""
    print(f"--- Calling REAL STT to process audio data ---")
    try:
        return recognize_speech_from_audio(audio_data)
    except Exception as e:
        print(f"--- REAL STT failed: {e} ---")
        return f"STT 오류: {e}"

def generate_speech(text: str) -> bytes:
    """실제 TTS 함수를 호출하여 음성을 생성합니다."""
    print(f"--- Calling REAL TTS for: '{text[:30]}...' ---")
    try:
        return generate_tts_audio(text)
    except Exception as e:
        print(f"--- REAL TTS failed: {e} ---")
        # Fallback to silent audio in case of any error
        samplerate = 16000; duration = 0.5
        header = b'RIFF' + (36).to_bytes(4, 'little') + b'WAVEfmt ' + (16).to_bytes(4, 'little') + (1).to_bytes(2, 'little') + (1).to_bytes(2, 'little') + samplerate.to_bytes(4, 'little') + (samplerate * 2).to_bytes(4, 'little') + (2).to_bytes(2, 'little') + (16).to_bytes(2, 'little') + b'data' + (int(samplerate*duration)*2).to_bytes(4, 'little')
        return header + (b'\x00' * int(samplerate*duration)*2)

# RAG search_rag 함수는 이제 rag.search 모듈에서 직접 import하여 사용합니다.
# Django의 views.py에서는 `from core import clients`를 통해 `clients.search_rag`를 호출하는데,
# 이 `clients.py`가 `rag.search`의 `search_rag`를 import하므로 최종적으로 연결됩니다.
