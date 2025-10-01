# (Google API 인증 테스트)
from google.cloud import texttospeech, speech

def test_google_cloud_clients():
    try:
        tts_client = texttospeech.TextToSpeechClient()
        print("✅ Google Cloud TTS 클라이언트 생성 성공")
    except Exception as e:
        print(f"❌ Google Cloud TTS 클라이언트 생성 실패: {e}")
        return False

    try:
        stt_client = speech.SpeechClient()
        print("✅ Google Cloud STT 클라이언트 생성 성공")
    except Exception as e:
        print(f"❌ Google Cloud STT 클라이언트 생성 실패: {e}")
        return False

    return True


if __name__ == "__main__":
    if test_google_cloud_clients():
        print("🎉 API 인증이 정상적으로 설정되었습니다.")
    else:
        print("⚠️ API 인증에 문제가 있습니다. GOOGLE_APPLICATION_CREDENTIALS 설정 확인 필요.")
