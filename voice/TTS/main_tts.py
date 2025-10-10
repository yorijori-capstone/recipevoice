from recipe_data import steps
from tts_player import speak_and_wait, cleanup_temp_files

def run_recipe():
    print("🍝 알리오 올리오 레시피 안내 시작\n")
    i = 0
    while i < len(steps):
        title, desc = steps[i]
        full_text = f"단계 {i+1}: {title}. {desc}."
        print(f"\n▶ {full_text}\n")

        cmd = speak_and_wait(full_text)

        if cmd == "next":
            i += 1
        elif cmd == "prev":
            i = max(0, i-1)
        elif cmd == "repeat":
            pass  # i 그대로 → 반복
        elif cmd == "quit":
            print("❌ 프로그램 종료")
            break

        print(f"✅ 단계 {i+1 if i<len(steps) else i} 완료!\n")

    print("🎉 모든 단계 완료! 맛있게 드세요 😋")
    speak_and_wait("모든 단계 완료! 맛있게 드세요.")


if __name__ == "__main__":
    try:
        run_recipe()
    finally:
        cleanup_temp_files()
