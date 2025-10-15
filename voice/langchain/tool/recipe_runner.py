from .tts_player import speak_and_wait, cleanup_temp_files
from .stt_listener import wait_for_next_command_from_mic

def run_recipe(steps):
    """
    단계별로 TTS 안내 + STT 명령어로 제어.
    steps: [(단계 제목, 단계 설명), ...]
    """
    if not steps:
        raise ValueError("steps 리스트를 전달해야 합니다.")

    print("\n🍝 레시피 안내 시작\n")

    i = 0
    while i < len(steps):
        title, desc = steps[i]
        full_text = f"{title}: {desc}."
        print(f"\n▶ {full_text}\n")

        # 현재 단계 TTS 안내
        speak_and_wait(full_text)

        # 명령어 대기 (TTS로 안내만 하고, 실제 인식은 STT로)
        speak_and_wait("명령어를 말하세요... (다음, 이전, 다시, 종료)")
        cmd = wait_for_next_command_from_mic()

        # 인식 실패 시 반복
        while cmd not in ["next", "prev", "repeat", "quit"]:
            print("❌ 인식 실패 → 다시 말해주세요.")
            speak_and_wait("인식에 실패했습니다. 다시 말해주세요.")
            cmd = wait_for_next_command_from_mic()

        # 명령어 처리
        if cmd == "next":
            print(f"✅ 단계 {i+1} 완료!")
            i += 1
        elif cmd == "prev":
            i = max(0, i - 1)
            print("🔁 이전 단계로 돌아갑니다.")
        elif cmd == "repeat":
            print("🔁 다시 반복합니다.")
        elif cmd == "quit":
            print("❌ 프로그램 종료")
            break

    print("🎉 모든 단계 완료! 맛있게 드세요 😋")
    speak_and_wait("모든 단계 완료! 맛있게 드세요.")

def cleanup():
    """임시 파일 제거"""
    cleanup_temp_files()
