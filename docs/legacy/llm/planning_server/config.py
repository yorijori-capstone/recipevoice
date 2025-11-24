import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """플래닝 서버 설정"""
    
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    LLM_MODEL = os.getenv("PLANNING_MODEL", os.getenv("OPENAI_PLANNING_MODEL", "gpt-4o-mini"))
    CHAT_MODEL = os.getenv("PLANNING_CHAT_MODEL", LLM_MODEL)
    LLM_TEMPERATURE = float(os.getenv("PLANNING_TEMPERATURE", "0.5"))
    LLM_MAX_TOKENS = int(os.getenv("PLANNING_MAX_TOKENS", "4096"))
    
    HOST = os.getenv("PLANNING_SERVER_HOST", "0.0.0.0")
    PORT = int(os.getenv("PLANNING_SERVER_PORT", "8100"))
    
    RAG_SERVER_URL = os.getenv("RAG_SERVER_URL", "http://127.0.0.1:8030")
    
    @classmethod
    def validate(cls):
        """필수 설정 검증"""
        if not cls.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY가 설정되지 않았습니다. "
                ".env 파일을 확인하세요."
            )
        
        print("✅ 설정 검증 완료")
        print(f"   - LLM 제공자: OpenAI")
        print(f"   - 플래닝 모델: {cls.LLM_MODEL}")
        print(f"   - 대화 모델: {cls.CHAT_MODEL}")
        print(f"   - 서버 주소: {cls.HOST}:{cls.PORT}")
        print(f"   - RAG 서버: {cls.RAG_SERVER_URL}")


if __name__ == "__main__":
    Config.validate()
