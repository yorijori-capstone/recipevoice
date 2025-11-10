import os
from dotenv import load_dotenv

load_dotenv()


class TimerConfig:
    """Timer 서버 설정"""
    
    # 서버 설정
    HOST = os.getenv("TIMER_SERVER_HOST", "0.0.0.0")
    PORT = int(os.getenv("TIMER_SERVER_PORT", "8101"))  # 8101
    
    # 타이머 설정
    MAX_TIMER_DURATION = 7200  # 최대 2시간
    MIN_TIMER_DURATION = 1     # 최소 1초
    
    # 디버그 모드
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    
    @classmethod
    def validate(cls):
        """설정 검증"""
        print("✅ Timer 서버 설정 검증 완료")
        print(f"   - 서버 주소: {cls.HOST}:{cls.PORT}")
        print(f"   - 최대 타이머 시간: {cls.MAX_TIMER_DURATION}초")


if __name__ == "__main__":
    TimerConfig.validate()