import sounddevice as sd
import numpy as np
from google.cloud import speech

# =======================
# Google STT 클라이언트 초기화
# =======================
try:
    client = speech.SpeechClient()
except Exception as e:
    print("Google Cloud STT 인증 오류:", e)
    raise

# =======================
# 마이크 녹음 설정
# =======================
DURATION = 5  # 녹음 시간(초)
SAMPLERATE = 16000  # STT 권장 샘플링 레이트
CHANNELS = 1

print(f"🎤 {DURATION}초간 음성 녹음 시작...")
recording = sd.rec(int(DURATION * SAMPLERATE), samplerate=SAMPLERATE, channels=CHANNELS, dtype='int16')
sd.wait()
print("🎤 녹음 완료")

# =======================
# STT 변환
# =======================
audio_bytes = recording.tobytes()

audio = speech.RecognitionAudio(content=audio_bytes)
config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=SAMPLERATE,
    language_code="ko-KR"  # 한국어
)

try:
    response = client.recognize(config=config, audio=audio)

    if response.results:
        transcript = response.results[0].alternatives[0].transcript
        print(f"📝 STT 인식 결과: {transcript}")
    else:
        print("⚠️ 음성을 인식하지 못했습니다.")

except Exception as e:
    print(f"[오류] STT 변환 실패: {e}")
