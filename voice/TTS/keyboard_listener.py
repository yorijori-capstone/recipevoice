# keyboard_listener.py (확장판)
import sys

def get_key_press():
    """
    플랫폼별로 단일 키 입력을 기다린 후 반환합니다.
    Windows → msvcrt.getch(), Linux/macOS → termios+tty
    """
    try:
        if sys.platform.startswith("win"):
            import msvcrt
            key = msvcrt.getch()
            return key.decode(errors="ignore").lower()
        else:
            import tty, termios
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                key = sys.stdin.read(1)
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            return key.lower()
    except Exception as e:
        print(f"[경고] 키 입력 대기 실패: {e}")
        return None

def wait_for_command():
    """
    키 입력 대기 후 명령을 반환합니다.
    반환값: "next", "prev", "repeat", "quit", None
    """
    key = get_key_press()
    if key is None:
        return None

    if key == "q":
        return "quit"
    elif key == "d":
        return "next"
    elif key == "a":
        return "prev"
    elif key == "r":
        return "repeat"
    else:
        return None
