# voice/TTS/tts_player.py
import os
from google.cloud import texttospeech
from google.oauth2 import service_account

# --- Google TTS Client Initialization ---
try:
    # .env 파일 또는 환경 변수에서 GCP 인증 정보를 로드합니다.
    # Django 서버 시작 시 한 번만 실행됩니다.
    env_keys = {
        "type": os.getenv("GCP_TYPE"),
        "project_id": os.getenv("GCP_PROJECT_ID"),
        "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GCP_PRIVATE_KEY", "").replace('\\n', '\n'),
        "client_email": os.getenv("GCP_CLIENT_EMAIL"),
        "client_id": os.getenv("GCP_CLIENT_ID"),
        "auth_uri": os.getenv("GCP_AUTH_URI"),
        "token_uri": os.getenv("GCP_TOKEN_URI"),
        "auth_provider_x509_cert_url": os.getenv("GCP_AUTH_PROVIDER_X509_CERT_URL"),
        "client_x509_cert_url": os.getenv("GCP_CLIENT_X509_CERT_URL"),
    }
    if all([env_keys["type"], env_keys["project_id"], env_keys["private_key"], env_keys["client_email"]]):
        print("[AUTH] Authenticating Google Cloud via .env variables.")
        credentials = service_account.Credentials.from_service_account_info(env_keys)
        client = texttospeech.TextToSpeechClient(credentials=credentials)
    else:
        print("[AUTH] .env variables not found. Falling back to default authentication (GOOGLE_APPLICATION_CREDENTIALS).")
        client = texttospeech.TextToSpeechClient()
    print("[AUTH] Google Cloud TTS client initialized successfully.")
except Exception as e:
    print(f"[ERROR] Google Cloud Authentication failed: {e}")
    client = None

def generate_tts_audio(text: str) -> bytes:
    """
    주어진 텍스트를 Google TTS를 사용하여 MP3 오디오 바이트로 변환합니다.
    이 함수는 이제 이 모듈의 유일한 공개 인터페이스입니다.
    """
    if not client:
        raise ConnectionError("Google TTS 클라이언트가 초기화되지 않았습니다. 인증을 확인하세요.")
    
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="ko-KR", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content

