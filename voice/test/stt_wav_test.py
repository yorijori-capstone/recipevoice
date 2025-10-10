# stt_wav_test.py (실험용: STT만)
from google.cloud import speech
import soundfile as sf

try:
    stt_client = speech.SpeechClient()
except Exception as e:
    print("Google Cloud STT 인증 오류:", e)
    raise

def check_next_command_from_wav(wav_path: str):
    """WAV 파일을 읽어서 STT 변환 후 '다음' 포함 여부 반환"""
    print(f"🎤 WAV 파일 분석 중: {wav_path}")
    try:
        # WAV 파일 읽기
        data, samplerate = sf.read(wav_path, dtype='int16')
        audio_bytes = data.tobytes()

        # Google Cloud Speech-to-Text 요청
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=samplerate,
            language_code="ko-KR"
        )
        response = stt_client.recognize(config=config, audio=audio)

        if not response.results:
            print("[STT 결과 없음]")
            return False

        transcript = response.results[0].alternatives[0].transcript.strip()
        print(f"[STT 인식 결과]: {transcript}")
        return "다음" in transcript

    except Exception as e:
        print(f"[경고] STT 처리 실패: {e}")
        return False


if __name__ == "__main__":
    wav_file = "./voice/test/다음.wav"  # "다음" 단어가 포함된 wav 파일 준비
    if check_next_command_from_wav(wav_file):
        print("✅ '다음' 명령어 인식됨 → 다음 단계로 진행!")
    else:
        print("❌ '다음' 명령어 인식 실패")
