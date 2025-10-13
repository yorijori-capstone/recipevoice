# llm/agent/tool/stt_tool.py
from langchain.tools import tool

@tool
def listen_for_command() -> str:
    """
    에이전트가 직접 서버 마이크에 접근하려는 시도를 차단하고,
    실제 음성 입력이 웹 UI를 통해 수집되어야 함을 안내합니다.
    """
    message = (
        "🎤 음성 입력 대기 중입니다. 웹 UI의 마이크 버튼을 눌러 "
        "녹음한 뒤 업로드해 주세요."
    )
    print("🎛️  listen_for_command tool invoked — deferring to client UI.")
    return message
