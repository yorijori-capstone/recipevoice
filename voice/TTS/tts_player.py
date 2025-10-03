# tts_player.py
import os
import uuid
import numpy as np
import sounddevice as sd
from pydub import AudioSegment
from google.cloud import texttospeech
from keyboard_listener import wait_for_command

temp_files_to_clean = []

# Google TTS 인증
try:
    client = texttospeech.TextToSpeechClient()
except Exception as e:
    print("Google Cloud 인증 오류:", e)
    raise


def speak_audio(audio_segment: AudioSegment):
    """AudioSegment → numpy array 변환 후 sounddevice로 재생"""
    print("[디버그] 🎵 오디오 재생 시작")
    samples = np.array(audio_segment.get_array_of_samples())
    samples = samples.astype(np.float32) / (2 ** (8 * audio_segment.sample_width - 1))
    if audio_segment.channels > 1:
        samples = samples.reshape((-1, audio_segment.channels))
    sd.play(samples, samplerate=audio_segment.frame_rate)
    sd.wait()  # 재생 끝날 때까지 블로킹
    print("[디버그] 🎵 오디오 재생 종료")


def speak_and_wait(text: str) -> str:
    """
    TTS 생성 → 재생 → 키 입력 대기
    반환값:
        "next" / "prev" / "repeat" / "quit"
    """
    filename = f"temp_tts_{uuid.uuid4()}.mp3"
    temp_files_to_clean.append(filename)

    try:
        print("[디버그] 🏗️ TTS 변환 시작")
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="ko-KR",
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        with open(filename, "wb") as out:
            out.write(response.audio_content)
        print(f"[디버그] ✅ TTS 파일 생성 완료: {filename}")

        print("[디버그] 🎧 AudioSegment 로드 시작")
        audio = AudioSegment.from_file(filename, format="mp3")
        print("[디버그] 🎧 AudioSegment 로드 완료")

        speak_audio(audio)  # blocking 재생

        # 키 입력 대기
        print("👉 키 입력으로 단계 진행: d=다음, a=이전, r=반복, q=종료")
        while True:
            cmd = wait_for_command()
            if cmd in ["next", "prev", "repeat", "quit"]:
                return cmd
            else:
                print("⚠️ 알 수 없는 키, 다시 눌러주세요.")

    except Exception as e:
        print(f"[오류] TTS/파일 처리 실패: {e}")
        # 오류 발생해도 다음 단계 진행하도록 "next" 반환
        return "next"


def cleanup_temp_files():
    print("\n[정리] 임시 오디오 파일 삭제 중...")
    for filename in temp_files_to_clean:
        if os.path.exists(filename):
            try:
                os.remove(filename)
                print(f" - {filename} 삭제 완료")
            except Exception as e:
                print(f"[경고] {filename} 삭제 실패: {e}")
