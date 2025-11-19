import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """플래닝 서버 설정"""
    
    # Gemini API 키
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # 서버 설정
    HOST = os.getenv("PLANNING_SERVER_HOST", "0.0.0.0")
    PORT = int(os.getenv("PLANNING_SERVER_PORT", "8100"))  # 8100으로 변경
    
    # RAG 서버 URL
    RAG_SERVER_URL = os.getenv("RAG_SERVER_URL", "http://127.0.0.1:8030")
    
    # LLM 설정 (Gemini)
    LLM_MODEL = "gemini-2.5-flash"
    LLM_TEMPERATURE = 0.5
    LLM_MAX_TOKENS = 8192
    
    @classmethod
    def validate(cls):
        """필수 설정 검증"""
        if not cls.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY가 설정되지 않았습니다. "
                ".env 파일을 확인하세요."
            )
        
        print("✅ 설정 검증 완료")
        print(f"   - LLM 제공자: Google Gemini")
        print(f"   - LLM 모델: {cls.LLM_MODEL}")
        print(f"   - 서버 주소: {cls.HOST}:{cls.PORT}")
        print(f"   - RAG 서버: {cls.RAG_SERVER_URL}")


if __name__ == "__main__":
    Config.validate()