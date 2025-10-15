# stt_listener.py
import os
import json
import re
import sounddevice as sd
import numpy as np
from google.cloud import speech
from difflib import SequenceMatcher
from text_utils import normalize_text  # normalize_text() 함수 필요

# --------------------------
# 1️⃣ qa_scenario.json 절대경로 지정
# --------------------------
QA_JSON_PATH = r"C:\빅종설\langchain없이_고도화\qa_scenario.json"

with open(QA_JSON_PATH, "r", encoding="utf-8") as f:
    SCENARIOS = json.load(f)

# --------------------------
# 2️⃣ Google STT 클라이언트
# --------------------------
try:
    stt_client = speech.SpeechClient()
except Exception as e:
    print("Google Cloud STT 인증 오류:", e)
    raise

# --------------------------
# 3️⃣ 문자열 유사도 기반 매칭 함수
# --------------------------
def match_input_to_scenario(user_input, threshold=0.65):
    user_input = normalize_text(user_input)
    best_match = None
    best_ratio = 0

    for scenario in SCENARIOS:
        for kw in scenario["keywords"]:
            kw_lower = normalize_text(kw)

            # 1️⃣ 부분 문자열 포함 시 즉시 매칭
            if kw_lower in user_input:
                return scenario, 1.0

            # 2️⃣ 유사도 비교
            ratio = SequenceMatcher(None, user_input, kw_lower).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = scenario

    if best_ratio >= threshold:
        return best_match, best_ratio
    return None, best_ratio

# --------------------------
# 4️⃣ 마이크 입력 → STT → QA 매칭
# --------------------------
def wait_for_next_command_from_mic():
    """
    마이크로 실시간 녹음 후 STT로 변환.
    QA 시나리오와 매칭 후 dict 반환
    """
    print("🎤 명령어를 말하세요...")

    try:
        duration = 3
        samplerate = 16000
        recording = sd.rec(int(duration * samplerate),
                           samplerate=samplerate, channels=1, dtype='int16')
        sd.wait()

        audio_bytes = recording.tobytes()
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=samplerate,
            language_code="ko-KR"
        )

        response = stt_client.recognize(config=config, audio=audio)
        if not response.results:
            print("[STT 결과 없음]")
            return None

        transcript = response.results[0].alternatives[0].transcript.strip()
        print(f"[STT 인식 결과]: {transcript}")

        # --------------------------
        # QA 시나리오 매칭
        # --------------------------
        scenario, ratio = match_input_to_scenario(transcript)
        if scenario:
            print(f"🔍 매칭 유사도: {ratio:.2f}")
            return {
                "answer_type": scenario["answer_type"],
                "param_key": scenario.get("param_key"),
                "message": scenario.get("message")
            }
        else:
            return {
                "answer_type": "unknown",
                "message": "⚠️ 입력을 이해하지 못했습니다. 다시 말씀해주세요."
            }

    except Exception as e:
        print(f"[경고] STT 처리 실패: {e}")
        return None
