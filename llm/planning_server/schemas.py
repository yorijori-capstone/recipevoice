from pydantic import BaseModel, Field
from typing import List


# ===== 입력 스키마 =====
class Ingredient(BaseModel):
    """재료 아이템"""
    name: str = Field(..., description="재료명")
    quantity: str = Field(..., description="수량")


class Step(BaseModel):
    """조리 단계"""
    order: int = Field(..., description="단계 순서")
    instruction: str = Field(..., description="조리 설명")


class RecipeInput(BaseModel):
    """플래닝 서버가 받는 원본 레시피 데이터"""
    title: str = Field(..., description="레시피 제목")
    ingredients: List[Ingredient] = Field(..., description="재료 목록")
    steps: List[Step] = Field(..., description="조리 단계")
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "엄마의 레시피, 소고기 미역국 끓이는 법",
                "ingredients": [
                    {"name": "소고기 국거리용", "quantity": "180g"},
                    {"name": "미역", "quantity": "20g"}
                ],
                "steps": [
                    {
                        "order": 1,
                        "instruction": "덩어리 고기를 사용할 경우, 고기의 결과 반대인 수직 방향으로 썰어주세요."
                    },
                    {
                        "order": 2,
                        "instruction": "미역 20g을 물에 불려주세요."
                    }
                ]
            }
        }


class PlannedStep(BaseModel):
    """음성 안내용 대화 스크립트"""
    order: int = Field(..., description="단계 순서")
    script: str = Field(..., description="음성 안내 스크립트 (대화체)")
    retry_script: str = Field(..., description="'다시' 명령 시 재설명 스크립트")
    pause_hint: str = Field(
        default="잠시 멈췄습니다. 준비되면 '계속'이라고 말씀해주세요.",
        description="'멈춰' 명령 시 안내 멘트"
    )
    fallback_script: str = Field(
        default="이해가 어려우시면 천천히 다시 설명해드릴게요.",
        description="'뭐라고?' 명령 시 대체 스크립트"
    )
    
    # ===== 타이머 기능 추가 =====
    estimated_time_sec: int = Field(
        default=60,
        description="예상 소요 시간 (초), 불명확하면 60초"
    )
    timer_required: bool = Field(
        default=False,
        description="타이머 필요 여부 (True=자동 타이머 시작)"
    )
    timer_message: str = Field(
        default="타이머를 시작합니다.",
        description="타이머 시작 시 안내 멘트"
    )
    # ========================


class PlanningOutput(BaseModel):
    """플래닝 서버 최종 출력"""
    title: str = Field(..., description="레시피 제목")
    opening_remark: str = Field(..., description="시작 인사말")
    planned_steps: List[PlannedStep] = Field(..., description="음성 안내 스크립트 목록")
    closing_remark: str = Field(..., description="마무리 인사말")
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "엄마의 레시피, 소고기 미역국 끓이는 법",
                "opening_remark": "안녕하세요! 지금부터 엄마의 레시피, 소고기 미역국 끓이기를 시작하겠습니다.",
                "planned_steps": [
                    {
                        "order": 1,
                        "script": "첫 번째 단계입니다. 덩어리 고기를 사용할 경우, 고기의 결과 반대인 수직 방향으로 썰어주세요."
                    },
                    {
                        "order": 2,
                        "script": "다음은 미역을 준비할 차례입니다. 미역 20g을 물에 불려주세요."
                    }
                ],
                "closing_remark": "이제 모든 요리가 끝났습니다. 맛있게 드세요! 안내를 종료할까요?"
            }
        }