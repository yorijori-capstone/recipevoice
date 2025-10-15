# main.py
from recipe_data import steps
from tts_player import speak_and_wait, cleanup_temp_files
from stt_listener import wait_for_next_command_from_mic

def run_recipe():
    print("🍝 알리오 올리오 레시피 안내 시작\n")
    i = 0
    while i < len(steps):
        title, desc = steps[i]
        full_text = f"단계 {i+1}: {title}. {desc}."
        print(f"\n▶ {full_text}\n")
        speak_and_wait(full_text)

        # --------------------------
        # 명령어 대기 루프 (STT 실패 시 단계 재출력 X)
        # --------------------------
        while True:
            speak_and_wait("명령어를 말하세요...")
            result = wait_for_next_command_from_mic()

            if result is None or result["answer_type"] == "unknown":
                speak_and_wait("인식에 실패했습니다. 다시 말씀해주세요.")
                continue  # 단계 TTS 다시 읽지 않고 STT만 재시도

            cmd = result["answer_type"]
            msg = result.get("message")
            if msg:
                print(msg)
                speak_and_wait(msg)

            # 단계 이동 처리
            if cmd == "next_step":
                i += 1
                break
            elif cmd == "prev_step":
                i = max(0, i - 1)
                break
            elif cmd == "repeat_step":
                # 현재 단계 TTS 반복
                speak_and_wait(full_text)
                continue
            elif cmd == "quit":
                print("❌ 프로그램 종료")
                return
            else:
                # unknown은 이미 처리
                continue

        print(f"✅ 단계 {i} 완료!\n")

    print("🎉 모든 단계 완료! 맛있게 드세요 😋")
    speak_and_wait("모든 단계 완료! 맛있게 드세요.")

# --------------------------
if __name__ == "__main__":
    try:
        run_recipe()
    finally:
        cleanup_temp_files()