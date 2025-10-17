import requests
from langchain.tools import tool

# --- 설정 ---
# Django 백엔드 서버의 주소입니다.
BASE_URL = "http://127.0.0.1:8000/api/recipes"

class RecipeState:
    """
    현재 진행 중인 요리 세션의 상태를 관리하는 싱글톤 클래스입니다.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RecipeState, cls).__new__(cls)
            cls._instance.current_recipe_id = None
            cls._instance.steps = []
            cls._instance.current_step_index = -1
        return cls._instance

    def set_recipe(self, recipe_id, steps):
        self.current_recipe_id = recipe_id
        self.steps = steps
        self.current_step_index = 0

    def get_current_step(self):
        if 0 <= self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None

    def go_next(self):
        if self.current_step_index < len(self.steps) - 1:
            self.current_step_index += 1
            return self.get_current_step()
        return {"message": "마지막 단계입니다."}

    def go_previous(self):
        if self.current_step_index > 0:
            self.current_step_index -= 1
            return self.get_current_step()
        return {"message": "첫 번째 단계입니다."}

    def reset(self):
        self.current_recipe_id = None
        self.steps = []
        self.current_step_index = -1

# --- 도구 정의 ---

@tool
def get_recipe_details(query: str) -> dict:
    """
    사용자가 요리하고 싶어하는 메뉴(예: '미역국')를 입력받아,
    해당 레시피의 상세 정보를 백엔드 서버에서 검색하여 반환합니다.
    검색 결과가 여러 개일 경우, 가장 관련성 높은 레시피 하나를 반환합니다.
    """
    print(f"🔍 '{query}' 레시피를 검색합니다...")
    try:
        search_response = requests.get(f"{BASE_URL}/search/", params={'q': query})
        search_response.raise_for_status()
        search_results = search_response.json()

        if not search_results:
            return {"error": f"'{query}'에 대한 레시피를 찾지 못했습니다."}

        first_recipe_id = search_results[0]['recipe_id']
        detail_response = requests.get(f"{BASE_URL}/{first_recipe_id}/")
        detail_response.raise_for_status()
        
        recipe_details = detail_response.json()
        print(f"✅ 레시피를 찾았습니다: {recipe_details['title']}")
        return recipe_details

    except requests.exceptions.RequestException as e:
        return {"error": f"API 요청 중 오류가 발생했습니다: {e}"}

@tool
def start_cooking_session(recipe_id: str) -> dict:
    """
    'get_recipe_details'로 얻은 레시피 ID를 입력받아 요리 세션을 시작합니다.
    세션이 시작되면, 전체 조리 단계 목록을 내부 상태에 저장하고
    첫 번째 조리 단계를 반환합니다.
    """
    print(f"▶️ 레시피 ID '{recipe_id}'로 요리 세션을 시작합니다...")
    try:
        response = requests.get(f"{BASE_URL}/{recipe_id}/")
        response.raise_for_status()
        recipe_details = response.json()
        
        state = RecipeState()
        state.set_recipe(recipe_id, recipe_details.get('steps', []))
        
        first_step = state.get_current_step()
        if first_step:
            print(f"📖 1단계: {first_step.get('text', '')}")
            return {"step": 1, "instruction": first_step.get('text', '')}
        else:
            return {"error": "조리 단계가 없는 레시피입니다."}

    except requests.exceptions.RequestException as e:
        return {"error": f"API 요청 중 오류가 발생했습니다: {e}"}

@tool
def next_step() -> dict:
    """
    현재 요리 세션의 다음 조리 단계를 반환합니다.
    """
    print("▶️ 다음 단계로 이동합니다...")
    state = RecipeState()
    next_step_data = state.go_next()
    if "message" in next_step_data:
        return next_step_data
    if next_step_data:
        return {"step": state.current_step_index + 1, "instruction": next_step_data.get('text', '')}
    return {"error": "다음 단계를 가져오는 데 실패했습니다."}

@tool
def previous_step() -> dict:
    """
    현재 요리 세션의 이전 조리 단계를 반환합니다.
    """
    print("◀️ 이전 단계로 이동합니다...")
    state = RecipeState()
    prev_step_data = state.go_previous()
    if "message" in prev_step_data:
        return prev_step_data
    if prev_step_data:
        return {"step": state.current_step_index + 1, "instruction": prev_step_data.get('text', '')}
    return {"error": "이전 단계를 가져오는 데 실패했습니다."}

@tool
def repeat_step() -> dict:
    """
    현재 요리 세션의 현재 조리 단계를 다시 한번 반환합니다.
    """
    print("🔁 현재 단계를 반복합니다...")
    state = RecipeState()
    current_step_data = state.get_current_step()
    if current_step_data:
        return {"step": state.current_step_index + 1, "instruction": current_step_data.get('text', '')}
    return {"error": "현재 단계를 가져오는 데 실패했습니다. 요리가 아직 시작되지 않았을 수 있습니다."}
