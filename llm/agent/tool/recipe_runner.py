# llm/agent/tool/recipe_runner.py
# 이 파일은 이제 중앙 LLM 서버를 호출하는 클라이언트 역할을 합니다.

# Django 프로젝트의 클라이언트를 사용하기 위해 core.clients를 import합니다.
# 이 파일이 Django 외부에서 직접 실행되지 않으므로, Django 환경 설정이 필요합니다.
# 현재 구조에서는 backend/recipes/views.py를 통해서만 호출되므로 직접적인 Django 설정은 불필요합니다.
from core import clients

def run_agent_once(query: str, chat_history: str = ""):
    """
    사용자 입력을 받아 중앙 LLM 서버의 챗 기능을 호출하고 결과를 반환합니다.
    """
    print(f"🍳 사용자 질문 (to LLM Server): {query}")
    try:
        # core.clients에 추가된 chat_with_llm 함수를 호출합니다.
        result = clients.chat_with_llm(user_input=query, chat_history=chat_history)
        
        # LLM 서버의 응답 형식에 맞춰 'output' 키의 값을 반환합니다.
        # (실제 서버 응답 형식에 따라 키는 변경될 수 있습니다.)
        return result.get('output', "오류: 응답을 생성하지 못했습니다.")
    except clients.APIClientError as e:
        print(f"LLM 서버 통신 중 오류 발생: {e}")
        return f"죄송합니다. 요청을 처리하는 중 오류가 발생했습니다: {e}"
    except Exception as e:
        print(f"에이전트 실행 중 예기치 않은 오류 발생: {e}")
        return f"죄송합니다. 요청을 처리하는 중 알 수 없는 오류가 발생했습니다."

