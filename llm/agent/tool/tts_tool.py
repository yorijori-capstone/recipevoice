# llm/agent/tool/tts_player.py
from langchain.tools import tool
from core import clients
import io
import pygame

# Pygame mixer 초기화 (오디오 재생에 필요)
pygame.mixer.init()

@tool
def speak(text: str) -> str:
    """
    이 도구는 입력받은 텍스트를 음성으로 변환하고 사용자에게 들려줍니다.
    실제 TTS 생성 및 오디오 출력은 중앙 클라이언트(core.clients)를 통해 처리됩니다.
    """
    print(f"🔊 LLM Agent requests to speak: '{text[:30]}...'")
    try:
        # 중앙 클라이언트를 통해 TTS 오디오 데이터 생성
        audio_content = clients.generate_speech(text)
        
        # 오디오 데이터를 메모리에서 직접 재생
        audio_fp = io.BytesIO(audio_content)
        pygame.mixer.music.load(audio_fp, 'mp3')
        pygame.mixer.music.play()

        # 재생이 끝날 때까지 대기
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
            
        return "음성 출력이 성공적으로 완료되었습니다."
    except Exception as e:
        error_message = f"음성 출력 중 오류 발생: {e}"
        print(f"⚠️ {error_message}")
        return error_message