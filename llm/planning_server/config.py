import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """플래닝 서버 설정"""
    
    # OpenAI API 키
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # 서버 설정
    HOST = os.getenv("PLANNING_SERVER_HOST", "0.0.0.0")
    PORT = int(os.getenv("PLANNING_SERVER_PORT", "8100"))
    
    # RAG 서버 URL
    RAG_SERVER_URL = os.getenv("RAG_SERVER_URL", "http://127.0.0.1:8030")
    
    # LLM 설정 (OpenAI GPT-5 Nano)
    LLM_MODEL = "gpt-5-nano"
    # 주의: GPT-5 Nano는 temperature를 지원하지 않음 (기본값 1 고정)
    LLM_MAX_COMPLETION_TOKENS = 4096  # GPT-5는 max_completion_tokens 사용
    
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
        print(f"   - LLM 모델: {cls.LLM_MODEL}")
        print(f"   - 서버 주소: {cls.HOST}:{cls.PORT}")
        print(f"   - RAG 서버: {cls.RAG_SERVER_URL}")


if __name__ == "__main__":
    Config.validate()