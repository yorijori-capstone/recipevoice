# tts_player.py
import os
import uuid
import numpy as np
import sounddevice as sd
from google.cloud import texttospeech
from pydub import AudioSegment
import html
from stt_listener import wait_for_next_command_from_mic

temp_files_to_clean = []

try:
    client = texttospeech.TextToSpeechClient()
except Exception as e:
    print("Google Cloud 인증 오류:", e)
    raise


def play_with_sounddevice(audio_segment):
    samples = np.array(audio_segment.get_array_of_samples())
    if audio_segment.channels > 1:
        samples = samples.reshape((-1, audio_segment.channels))
    samples = samples.astype(np.float32) / (2 ** 15)

    sd.play(samples, samplerate=audio_segment.frame_rate)
    sd.wait()


def speak_and_wait(text, tone="chef"):
    filename = f"temp_tts_{uuid.uuid4()}.mp3"
    temp_files_to_clean.append(filename)

    # ✅ 1️⃣ 특수문자/줄바꿈 SSML 안전 이스케이프
    safe_text = html.escape(text.strip())

    if tone == "chef":
        # 🧒 변성기 전 + 리듬감 + 자연스러움 유지
        ssml_text = f"""
        <speak>
            <prosody rate="medium" pitch="-3st" volume="+2dB">
                {safe_text.replace(' ', '<break time="80ms"/> ')}
            </prosody>
            <break time="250ms"/>
        </speak>
        """
        voice = texttospeech.VoiceSelectionParams(
            language_code="ko-KR",
            name="ko-KR-Neural2-A"  # ✅ 최신 신경망 음성 명시
        )
    else:
        ssml_text = f"<speak>{safe_text}</speak>"
        voice = texttospeech.VoiceSelectionParams(
            language_code="ko-KR",
            name="ko-KR-Standard-A"  # ✅ fallback 음성
        )

    try:
        synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
            pitch=0.0
        )

        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )

        with open(filename, "wb") as out:
            out.write(response.audio_content)

        # ✅ 안정적 재생
        audio = AudioSegment.from_file(filename, format="mp3")
        play_with_sounddevice(audio)

    except Exception as e:
        print(f"[오류] TTS 처리 실패: {e}")


def cleanup_temp_files():
    print("\n[정리] 임시 오디오 파일 삭제 중...")
    for filename in temp_files_to_clean:
        if os.path.exists(filename):
            try:
                os.remove(filename)
                print(f" - {filename} 삭제 완료")
            except Exception as e:
                print(f"[경고] {filename} 삭제 실패: {e}")
