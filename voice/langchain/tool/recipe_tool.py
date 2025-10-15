# tool/recipe_tool.py
from langchain.tools import tool
import ast
from .recipe_runner import run_recipe, cleanup

@tool
def recipe_tool(steps_list: str):
    """
    문자열 또는 리스트 형태의 레시피 단계를 입력받아
    파싱 후 단계별로 STT 제어가 가능한 TTS 안내를 실행합니다.
    """

    # 1️⃣ 문자열 → Python 객체로 변환 시도
    try:
        if isinstance(steps_list, str):
            steps = ast.literal_eval(steps_list)
        else:
            steps = steps_list
    except Exception as e:
        print(f"❌ steps_list 파싱 실패: {e}")
        return "레시피 리스트를 파싱할 수 없습니다."

    # 2️⃣ 리스트 검증 및 튜플화
    if not steps:
        return "❌ steps_list가 비어 있습니다."

    # ex: ["1. 면을 삶는다", "2. 소스를 만든다"] → [("단계 1", "1. 면을 삶는다"), ...]
    if isinstance(steps[0], str):
        steps = [(f"단계 {i+1}", step) for i, step in enumerate(steps)]

    # ex: [("제목", "설명")] 형식이 아니라면 강제 변환
    elif isinstance(steps[0], (list, tuple)) and len(steps[0]) == 2:
        steps = [(str(t[0]), str(t[1])) for t in steps]
    else:
        return "❌ steps 형식이 올바르지 않습니다. [(제목, 설명), ...] 형태여야 합니다."

    # 3️⃣ 단계별 실행
    try:
        run_recipe(steps)
    except Exception as e:
        print(f"⚠️ 실행 중 오류: {e}")
        return "레시피 실행 중 오류가 발생했습니다."
    finally:
        cleanup()

    return "✅ 레시피 안내 완료!"


