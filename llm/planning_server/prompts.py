"""
LLM 프롬프트 템플릿 (최적화 버전)
레시피를 음성 안내용 대화 스크립트로 변환
"""


SYSTEM_PROMPT = """요리 안내 AI. 레시피를 음성 스크립트로 변환.

절대 규칙:
1. 제공된 정보만 사용 (창작 금지)
2. 영문자→한글 (g→그램, L→리터, ml→밀리리터)
3. 대화체 ("~해주세요", "~하시면 됩니다")
4. 타이머: "끓이다", "볶다" 등 대기 시간 있으면 true

JSON만 출력:
{
  "opening_remark": "시작 인사",
  "planned_steps": [{
    "order": 순서,
    "script": "기본 안내",
    "retry_script": "상세 설명",
    "estimated_time_sec": 초,
    "timer_required": true/false
  }],
  "closing_remark": "마무리"
}"""


def create_planning_prompt(title: str, ingredients: list, steps: list) -> str:
    """
    레시피 데이터를 받아 LLM 프롬프트 생성 (최소화 버전)
    
    Args:
        title: 레시피 제목
        ingredients: 재료 목록 [{"name": "재료명", "quantity": "수량"}, ...]
        steps: 조리 단계 [{"order": 1, "instruction": "설명"}, ...]
    
    Returns:
        str: LLM에 전달할 프롬프트
    """
    
    # 재료 (간결하게)
    ingredients_text = "\n".join([
        f"- {ing['name']}: {ing['quantity']}" 
        for ing in ingredients
    ])
    
    # 조리 단계 (간결하게)
    steps_text = "\n".join([
        f"{step['order']}. {step['instruction']}" 
        for step in steps
    ])
    
    # 최소화된 프롬프트
    user_prompt = f"""레시피: {title}

재료:
{ingredients_text}

단계:
{steps_text}

위 레시피를 음성 안내 JSON으로 변환하세요.
- 영문자는 반드시 한글로 (g→그램, L→리터)
- 제공된 정보만 사용 (창작 금지)
- 대화체 사용"""
    
    return user_prompt


# 프롬프트 검증용 예시 데이터
EXAMPLE_RECIPE = {
    "title": "엄마의 레시피, 소고기 미역국 끓이는 법",
    "ingredients": [
        {"name": "소고기 국거리용", "quantity": "180g"},
        {"name": "미역", "quantity": "20g"},
        {"name": "참기름", "quantity": "1큰술"},
        {"name": "국간장", "quantity": "1큰술"}
    ],
    "steps": [
        {
            "order": 1,
            "instruction": "덩어리 고기를 사용할 경우, 고기의 결과 반대인 수직 방향으로 썰어주세요."
        },
        {
            "order": 2,
            "instruction": "미역 20g을 물에 불려주세요."
        },
        {
            "order": 3,
            "instruction": "냄비에 참기름을 두르고 고기와 미역을 볶아주세요."
        },
        {
            "order": 4,
            "instruction": "물 1L를 붓고 끓여주세요."
        }
    ]
}


# 테스트용 함수
if __name__ == "__main__":
    # 프롬프트 생성 테스트
    prompt = create_planning_prompt(
        title=EXAMPLE_RECIPE["title"],
        ingredients=EXAMPLE_RECIPE["ingredients"],
        steps=EXAMPLE_RECIPE["steps"]
    )
    print(prompt)