# voice/stt_service.py
import os
import json
import io
from typing import Optional
import speech_recognition as sr
from dotenv import load_dotenv
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError

GCP_CREDENTIALS_JSON_STR = None

def initialize_stt_client():
    """
    .env 파일 또는 환경 변수에서 GCP 인증 정보를 로드하여
    STT 클라이언트를 초기화합니다.
    """
    global GCP_CREDENTIALS_JSON_STR
    if GCP_CREDENTIALS_JSON_STR is not None:
        return

    print("[AUTH] Building Google Cloud STT credentials...")
    load_dotenv()
    
    env_keys = {
        "type": os.getenv("GCP_TYPE"),
        "project_id": os.getenv("GCP_PROJECT_ID"),
        "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GCP_PRIVATE_KEY", "").replace("\n", "\n"),
        "client_email": os.getenv("GCP_CLIENT_EMAIL"),
        "client_id": os.getenv("GCP_CLIENT_ID"),
        "auth_uri": os.getenv("GCP_AUTH_URI"),
        "token_uri": os.getenv("GCP_TOKEN_URI"),
        "auth_provider_x509_cert_url": os.getenv("GCP_AUTH_PROVIDER_X509_CERT_URL"),
        "client_x509_cert_url": os.getenv("GCP_CLIENT_X509_CERT_URL"),
    }

    if all(env_keys.values()):
        GCP_CREDENTIALS_JSON_STR = json.dumps(env_keys)
        print("[AUTH] STT credentials built successfully from .env variables.")
    else:
        print("[AUTH] .env variables for STT not found. Falling back to GOOGLE_APPLICATION_CREDENTIALS file.")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if credentials_path and os.path.exists(credentials_path):
            with open(credentials_path, "r", encoding="utf-8") as f:
                GCP_CREDENTIALS_JSON_STR = f.read()
            print("[AUTH] STT credentials loaded successfully from file.")
        else:
            print("[ERROR] No valid Google Cloud credentials found for STT.")
            GCP_CREDENTIALS_JSON_STR = None

initialize_stt_client()

def _detect_audio_format(audio_bytes: bytes) -> Optional[str]:
    header = audio_bytes[:4]
    if header.startswith(b"RIFF"):
        return "wav"
    if header == b"OggS":
        return "ogg"
    if header == b"fLaC":
        return "flac"
    if header == b"\x1A\x45\xDF\xA3":
        return "webm"
    return None

def _normalize_audio_to_wav(audio_bytes: bytes) -> bytes:
    """
    다양한 포맷(webm, ogg 등)의 오디오를 16kHz 모노 WAV 바이트로 변환합니다.
    """
    detected_format = _detect_audio_format(audio_bytes)
    buffer = io.BytesIO(audio_bytes)

    try:
        audio_segment = AudioSegment.from_file(buffer, format=detected_format)
    except CouldntDecodeError as exc:
        raise ValueError("지원하지 않는 오디오 형식입니다.") from exc
    except FileNotFoundError as exc:
        raise ValueError("오디오 디코더(ffmpeg)가 설치되어 있지 않습니다.") from exc

    # Google STT 권장 사양으로 정규화
    normalized_segment = audio_segment.set_frame_rate(16000).set_channels(1)
    wav_buffer = io.BytesIO()
    normalized_segment.export(wav_buffer, format="wav")
    return wav_buffer.getvalue()

def recognize_speech_from_audio(audio_bytes: bytes) -> str:
    """
    오디오 바이트 데이터를 받아 텍스트로 변환합니다.
    프론트엔드에서 전송된 오디오를 처리하기 위한 함수입니다.
    """
    if GCP_CREDENTIALS_JSON_STR is None:
        raise ConnectionError("Google Cloud STT 인증 정보가 설정되지 않았습니다.")

    r = sr.Recognizer()
    try:
        wav_bytes = _normalize_audio_to_wav(audio_bytes)

        with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
            audio_data = r.record(source)

        print("...음성 인식 처리 중...")
        text = r.recognize_google_cloud(
            audio_data,
            credentials_json=GCP_CREDENTIALS_JSON_STR,
            language='ko-KR'
        )
        print(f"🗣️  인식 결과: '{text}'")
        return text
    except ValueError as exc:
        return f"지원하지 않는 오디오 형식입니다: {exc}"
    except sr.UnknownValueError:
        return "음성을 인식할 수 없습니다."
    except sr.RequestError as e:
        return f"서비스 오류: {e}"
    except Exception as e:
        return f"오디오 처리 중 오류 발생: {e}"
