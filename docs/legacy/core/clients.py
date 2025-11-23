# backend/core/clients.py
import os
import requests
from typing import Dict, Any
from pathlib import Path

from openai import OpenAI

# --- Exception Class ---
class APIClientError(Exception):
    """API 클라이언트에서 발생하는 모든 예외에 대한 기본 클래스"""
    pass

# --- Global Variables ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent
LLM_SERVER_URL = os.getenv("PLANNING_SERVER_URL", "http://localhost:8100")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-mini-realtime-preview")
_openai_client: OpenAI | None = None

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

# --- OpenAI Realtime helpers ---
def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise APIClientError("OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def create_realtime_session() -> Dict[str, Any]:
    """OpenAI Realtime 세션용 클라이언트 시크릿을 생성합니다."""
    client = _get_openai_client()
    try:
        secret = client.realtime.client_secrets.create(
            session={
                "type": "realtime",
                "model": OPENAI_REALTIME_MODEL,
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "turn_detection": {
                            "type": "server_vad",
                            "silence_duration_ms": 1800,
                            "create_response": False,
                            "prefix_padding_ms": 300,
                            "threshold": 0.5,
                        },
                    },
                    "output": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "voice": "verse",
                    },
                },
            }
        )
        return secret.to_dict() if hasattr(secret, "to_dict") else secret
    except Exception as exc:
        raise APIClientError(f"Realtime 세션 생성 실패: {exc}") from exc
