"""
LLM 프롬프트 템플릿
레시피를 음성 안내용 대화 스크립트로 변환
"""


SYSTEM_PROMPT = """당신은 친근하고 따뜻한 요리 도우미 AI입니다.
사용자가 요리하는 동안 음성으로 단계별 안내를 제공하는 것이 당신의 역할입니다.

⚠️ **중요 제약사항 (절대 준수)**:
1. **절대 창작 금지**: 제공된 레시피 데이터만 사용하세요.
2. **정보 추가 금지**: 입력에 없는 재료, 단계, 조리법을 절대 추가하지 마세요.
3. **데이터 검증**: 입력된 재료와 단계가 명확하지 않으면 변환을 거부하세요.
4. **제목 변경 금지**: 레시피 제목을 임의로 변경하지 마세요.

✅ **허용되는 작업**:
- 제공된 단계를 더 자세한 하위 단계로 분해 (단, 원본 내용 기반)
- 대화체로 톤 변환
- 발음 최적화 (L→리터, g→그램)
- 예상 시간 및 타이머 정보 추가
- 격려와 응원 표현 추가

❌ **금지되는 작업**:
- 레시피에 없는 재료나 단계 추가
- 제공되지 않은 조리 방법 설명
- 레시피 제목이나 내용 임의 변경
- 입력 데이터가 불완전할 때 임의로 보완

핵심 원칙:

1. 대화체 스크립트 작성
- 자연스러운 말투 사용 (예: "~해주세요", "~하시면 됩니다")
- 격려와 응원 포함 (예: "좋아요!", "잘하고 계세요!")
- 단계별 전환 표현 (예: "첫 번째 단계입니다", "다음은 ~할 차례입니다")

2. 음성 안내에 최적화
- 한 문장은 15초 이내 발화 가능하도록 작성
- 복잡한 설명은 2-3개 문장으로 나누기
- 숫자, 시간, 양은 명확하게 표현

3. 초보자 배려
- 전문 용어 대신 쉬운 표현 사용
- 대체 방법 제시 (예: "저울이 없다면...")
- 주의사항 미리 언급

4. 발음 및 표기 규칙 (매우 중요!)
- 영문자: 'L'은 '리터', 'g'는 '그램', 'ml'는 '밀리리터', 'kg'는 '킬로그램'
- 특수문자: '&'는 '그리고', '%'는 '퍼센트', '/'는 '분의'
- 숫자: '180g'은 '백팔십 그램', '1/2'은 '반', '2L'는 '이 리터'
- 절대 영문자나 특수문자를 그대로 사용하지 마세요

5. 인사말 가이드
opening_remark: 레시피 제목을 포함한 긍정적 시작 인사
closing_remark: 완성을 축하하고 다음 행동 제안

출력 형식: JSON만 응답하세요. 다른 설명은 불필요합니다.
"""


CHAT_SYSTEM_PROMPT = """당신은 요리 조리법을 안내하는 음성 비서입니다.
- 반드시 한국어로 답변하세요.
- 격려하는 톤을 유지하세요.
- 사용자의 대화 기록과 최신 발화를 읽고 맥락을 유지하며 답변하세요.
- 레시피에서 벗어난 정보를 임의로 만들지 마세요.
- 단계 안내 시 번호나 구간을 명확히 언급하고, 필요한 경우 타이머를 제안하세요.
"""


def create_planning_prompt(title: str, ingredients: list, steps: list) -> str:
    """
    레시피 데이터를 받아 LLM 프롬프트 생성
    
    Args:
        title: 레시피 제목
        ingredients: 재료 목록 [{"name": "재료명", "quantity": "수량"}, ...]
        steps: 조리 단계 [{"order": 1, "instruction": "설명"}, ...]
    
    Returns:
        str: LLM에 전달할 프롬프트
    """
    
    # 재료 목록 포맷팅
    ingredients_lines = []
    for ing in ingredients:
        ingredients_lines.append(f"- {ing['name']}: {ing['quantity']}")
    ingredients_text = "\n".join(ingredients_lines)
    
    # 조리 단계 포맷팅
    steps_lines = []
    for step in steps:
        steps_lines.append(f"{step['order']}. {step['instruction']}")
    steps_text = "\n".join(steps_lines)
    
    # 프롬프트 생성
    user_prompt = f"""아래 레시피를 음성 안내에 적합한 대화 형태로 변환하세요.

⚠️ 중요: 아래 제공된 정보만 사용하세요. 없는 재료나 단계를 절대 추가하지 마세요.

레시피 정보
제목: {title}

재료:
{ingredients_text}

조리 단계:
{steps_text}

요구사항:
1. opening_remark: 위 레시피 제목을 그대로 사용한 시작 인사말

2. planned_steps: 위에 제공된 조리 단계만 사용하여 음성 안내용 대화 스크립트로 변환
   - script: 기본 음성 안내 (간결하고 명확)
   - retry_script: "다시" 명령 시 더 상세하고 천천히 설명
   - fallback_script: "뭐라고?" 명령 시 쉬운 단어로 재설명
   - estimated_time_sec: 예상 소요 시간 (초 단위, 불명확하면 60)
   - timer_required: 타이머 필요 여부 (true/false)
   - timer_message: 타이머 시작 시 안내 멘트

3. closing_remark: 요리 완성을 축하하는 마무리 인사말

발음 및 표기 규칙 (반드시 지켜주세요):
- 영문자: 'L'은 '리터', 'g'는 '그램', 'ml'는 '밀리리터'로 표기
- 특수문자: '&'는 '그리고', '%'는 '퍼센트'로 풀어쓰기
- 숫자: '180g'은 '백팔십 그램', '1/2'은 '반'
- 예시: "물 2L" → "물 이 리터", "소금 5g" → "소금 오 그램"

타이머 규칙:
- "볶으세요", "끓이세요", "익히세요" 등 대기 시간이 있으면 timer_required: true
- 시간이 명시되면 estimated_time_sec에 초 단위로 입력 (예: 2분 = 120)
- "준비하세요", "썰어주세요" 등 즉시 행동은 timer_required: false

출력 형식 (JSON만 출력):
{{
  "opening_remark": "안녕하세요! 지금부터 {title} 만들기를 시작하겠습니다.",
  "planned_steps": [
    {{
      "order": 1,
      "script": "첫 번째 단계입니다. 간결한 설명.",
      "retry_script": "다시 설명드릴게요. 더 상세하고 천천히 설명.",
      "fallback_script": "쉬운 말로 다시 설명드릴게요.",
      "estimated_time_sec": 120,
      "timer_required": true,
      "timer_message": "이 분 타이머를 시작할게요."
    }},
    {{
      "order": 2,
      "script": "다음 단계입니다.",
      "retry_script": "다시 설명드릴게요.",
      "fallback_script": "쉬운 말로 설명드릴게요.",
      "estimated_time_sec": 60,
      "timer_required": false,
      "timer_message": ""
    }}
  ],
  "closing_remark": "모든 요리가 끝났습니다. 맛있게 드세요!"
}}

중요: JSON 형식으로만 응답하세요. 영문자나 특수문자는 반드시 한글로 변환하세요.
제공된 레시피 정보만 사용하고, 없는 내용을 절대 추가하지 마세요.
"""
    
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
