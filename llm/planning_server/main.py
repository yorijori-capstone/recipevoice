from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel, Field
from typing import Literal

from .schemas import RecipeInput, PlanningOutput, PlannedStep
from .llm_client import LLMClient
from .config import Config

# 설정 검증
Config.validate()

# FastAPI 앱 생성
app = FastAPI(
    title="Yorijori Planning Server",
    description="레시피를 음성 안내용 대화 스크립트로 변환하는 플래닝 서버 (Google Gemini)",
    version="1.0.0"
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LLM 클라이언트 초기화 (Gemini)
llm_client = LLMClient(api_key=Config.GEMINI_API_KEY)


@app.get("/")
async def root():
    """헬스 체크"""
    return {
        "service": "Yorijori Planning Server",
        "llm_provider": "Google Gemini",
        "llm_model": Config.LLM_MODEL,
        "status": "running",
        "version": "1.0.0",
        "endpoints": [
            "POST /plan - 레시피 음성 안내 스크립트 생성",
            "POST /plan/test - 테스트용 샘플 레시피",
            "GET /health - 서버 상태 확인"
        ]
    }


@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "llm_model": Config.LLM_MODEL,
        "llm_provider": "Google Gemini",
        "rag_server": Config.RAG_SERVER_URL
    }


@app.post("/plan", response_model=PlanningOutput)
async def create_plan(recipe: RecipeInput):
    """
    레시피 데이터를 받아 음성 안내용 대화 스크립트 생성
    
    Args:
        recipe: 원본 레시피 데이터
            - title: 레시피 제목
            - ingredients: 재료 목록 [{"name": "재료명", "quantity": "수량"}, ...]
            - steps: 조리 단계 [{"order": 1, "instruction": "설명"}, ...]
    
    Returns:
        PlanningOutput:
            - title: 레시피 제목
            - opening_remark: 시작 인사말
            - planned_steps: 음성 안내 스크립트 [{"order": 1, "script": "..."}, ...]
            - closing_remark: 마무리 인사말
    
    Raises:
        HTTPException: LLM 호출 실패 시
    """
    
    try:
        # LLM 호출하여 음성 안내 스크립트 생성
        plan_data = llm_client.generate_plan(
            title=recipe.title,
            ingredients=[ing.dict() for ing in recipe.ingredients],
            steps=[step.dict() for step in recipe.steps]
        )
        
        # 응답 구조화
        output = PlanningOutput(
            title=recipe.title,
            opening_remark=plan_data["opening_remark"],
            planned_steps=plan_data["planned_steps"],
            closing_remark=plan_data["closing_remark"]
        )
        
        return output
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"플래닝 생성 실패: {str(e)}"
        )


@app.post("/plan/test")
async def test_plan():
    """
    테스트용 엔드포인트 (샘플 레시피로 테스트)
    """
    sample_recipe = RecipeInput(
        title="엄마의 레시피, 소고기 미역국 끓이는 법",
        ingredients=[
            {"name": "소고기 국거리용", "quantity": "180g"},
            {"name": "미역", "quantity": "20g"},
            {"name": "참기름", "quantity": "1큰술"},
            {"name": "국간장", "quantity": "1큰술"}
        ],
        steps=[
            {
                "order": 1,
                "instruction": "덩어리 고기를 사용할 경우, 고기의 결과 반대인 수직 방향으로 썰어주세요."
            },
            {
                "order": 2,
                "instruction": "미역 20g을 물에 불려주세요. 저울이 없다면 사진을 참고해서 양을 조절하시면 됩니다."
            },
            {
                "order": 3,
                "instruction": "냄비에 참기름을 두르고 센 불에서 고기와 미역을 볶아주세요."
            },
            {
                "order": 4,
                "instruction": "물 1L를 붓고 끓여주세요. 끓으면 국간장으로 간을 맞추세요."
            }
        ]
    )
    
    return await create_plan(sample_recipe)


# 서버 실행 함수
def start_server():
    """서버 시작 (개발용)"""
    uvicorn.run(
        "llm.planning_server.main:app",
        host=Config.HOST,
        port=Config.PORT,
        reload=True  # 코드 변경 시 자동 재시작
    )

# ===== 예외 처리 엔드포인트 수정 =====

class ControlRequest(BaseModel):
    """제어 명령 요청"""
    command: Literal["pause", "resume", "retry", "clarify"] = Field(
        ..., 
        description="pause=멈춰, resume=계속, retry=다시, clarify=뭐라고?"
    )
    current_step_order: int = Field(..., description="현재 진행 중인 단계 번호")
    current_step: PlannedStep = Field(..., description="현재 단계 정보")

class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    input: str
    chat_history: str = ""

@app.post("/control")
async def handle_control_command(request: ControlRequest):
    """
    제어 명령어 처리
    
    사용자가 "멈춰", "다시", "뭐라고?" 같은 명령을 할 때 호출
    
    Args:
        request: 명령어 + 현재 단계 정보
    
    Returns:
        해당 명령에 맞는 스크립트
    """
    
    step = request.current_step
    
    # 명령어별 응답
    response = {
        "command": request.command,
        "step_order": request.current_step_order,
        "message": ""
    }
    
    if request.command == "pause":
        response["message"] = step.pause_hint
        response["action"] = "TTS를 일시정지하고 사용자 입력 대기"
    
    elif request.command == "resume":
        response["message"] = f"다시 시작할게요. {step.script}"
        response["action"] = "현재 단계 script를 처음부터 다시 재생"
    
    elif request.command == "retry":
        response["message"] = step.retry_script
        response["action"] = "retry_script를 재생"
    
    elif request.command == "clarify":
        response["message"] = step.fallback_script
        response["action"] = "fallback_script를 재생"
    
    return response

@app.post("/chat")
async def handle_chat(request: ChatRequest):
    """
    일반적인 사용자 대화를 처리합니다.
    LangChain 에이전트의 요청을 받아 LLM을 호출하고 응답을 반환합니다.
    """
    try:
        # LLM 클라이언트를 사용하여 대화 응답 생성
        response_text = llm_client.generate_chat_response(
            user_input=request.input,
            chat_history=request.chat_history
        )
        return {"output": response_text}
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"채팅 처리 실패: {str(e)}"
        )

if __name__ == "__main__":
    start_server()

