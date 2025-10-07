# tts_player.py
import os
import uuid
import numpy as np
import sounddevice as sd
from pydub import AudioSegment
from google.cloud import texttospeech
from google.oauth2 import service_account
from .keyboard_listener import wait_for_command

temp_files_to_clean = []

def get_gcp_credentials_from_env():
    """Builds Google Cloud credentials from environment variables."""
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
    if not all([env_keys["type"], env_keys["project_id"], env_keys["private_key"], env_keys["client_email"]]):
        return None
    return service_account.Credentials.from_service_account_info(env_keys)

# --- Google TTS Client Initialization ---
try:
    credentials = get_gcp_credentials_from_env()
    if credentials:
        print("[AUTH] Authenticating Google Cloud via .env variables.")
        client = texttospeech.TextToSpeechClient(credentials=credentials)
    else:
        print("[AUTH] .env variables not found. Falling back to default authentication (GOOGLE_APPLICATION_CREDENTIALS).")
        client = texttospeech.TextToSpeechClient()
    print("[AUTH] Google Cloud TTS client initialized successfully.")
except Exception as e:
    print(f"[ERROR] Google Cloud Authentication failed: {e}")
    client = None

def generate_tts_audio(text: str) -> bytes:
    """Pure function to convert text to audio bytes using Google TTS."""
    if not client:
        raise ConnectionError("Google TTS client is not initialized. Check authentication.")
    
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="ko-KR", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content

def speak_audio(audio_segment: AudioSegment):
    """Plays an AudioSegment using sounddevice."""
    samples = np.array(audio_segment.get_array_of_samples()).astype(np.float32) / (2**(8 * audio_segment.sample_width - 1))
    if audio_segment.channels > 1:
        samples = samples.reshape((-1, audio_segment.channels))
    sd.play(samples, samplerate=audio_segment.frame_rate)
    sd.wait()

def speak_and_wait(text: str) -> str:
    """(For standalone testing) Generates TTS, saves to file, plays, and waits for keyboard command."""
    filename = f"temp_tts_{uuid.uuid4()}.mp3"
    temp_files_to_clean.append(filename)
    try:
        audio_content = generate_tts_audio(text)
        with open(filename, "wb") as out:
            out.write(audio_content)
        
        audio = AudioSegment.from_file(filename, format="mp3")
        speak_audio(audio)

        print("👉 Keyboard commands: d=next, a=prev, r=repeat, q=quit")
        while True:
            cmd = wait_for_command()
            if cmd in ["next", "prev", "repeat", "quit"]:
                return cmd
            else:
                print("Unknown key. Please try again.")
    except Exception as e:
        print(f"[ERROR] Failed during speak_and_wait: {e}")
        return "next"

def cleanup_temp_files():
    print("\nCleaning up temporary audio files...")
    for filename in temp_files_to_clean:
        if os.path.exists(filename):
            try:
                os.remove(filename)
                print(f" - Deleted {filename}")
            except Exception as e:
                print(f"[WARNING] Failed to delete {filename}: {e}")
