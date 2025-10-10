# stt_listener.py (마이크 실시간 버전)
import sounddevice as sd
import numpy as np
from google.cloud import speech

try:
    stt_client = speech.SpeechClient()
except Exception as e:
    print("Google Cloud STT 인증 오류:", e)
    raise


def wait_for_next_command_from_mic():
    """
    마이크로 실시간 녹음 후 STT로 변환.
    인식된 명령어: '다음' → next, '이전' → prev, '다시' → repeat, '종료' → quit
    없으면 None 반환
    """
    print("🎤 명령어를 말하세요...(다음/이전/다시/종료)")

    try:
        duration = 3  # 3초 녹음
        samplerate = 16000
        recording = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='int16')
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

        if "다음" in transcript:
            return "next"
        elif "이전" in transcript:
            return "prev"
        elif "다시" in transcript:
            return "repeat"
        elif "종료" in transcript:
            return "quit"
        else:
            return None

    except Exception as e:
        print(f"[경고] STT 처리 실패: {e}")
        return None
