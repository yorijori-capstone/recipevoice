"""
중앙 LLM 서버를 한 번 호출해 응답을 돌려주는 헬퍼.
"""

from typing import Optional

from core import clients


def _compose_prompt(user_input: Optional[str], plan_context: Optional[str]) -> str:
    sections = []
    if plan_context:
        sections.append("### 음성 안내 스크립트\n" + plan_context.strip())
    if user_input:
        sections.append("### 사용자 요청\n" + user_input.strip())
    prompt = "\n\n".join(sections).strip()
    if prompt:
        return prompt
    return "주어진 음성 안내 스크립트를 바탕으로 인사말과 요약을 제공해줘."


def run_agent_once(
    query: Optional[str],
    chat_history: str = "",
    plan_context: Optional[str] = None,
) -> str:
    """
    사용자 입력과 플래닝 결과를 결합해 LLM 서버(/chat)를 호출합니다.
    """
    llm_input = _compose_prompt(query, plan_context)
    try:
        result = clients.chat_with_llm(user_input=llm_input, chat_history=chat_history)
        return result.get("output", "오류: 응답을 생성하지 못했습니다.")
    except clients.APIClientError as exc:
        print(f"LLM 서버 통신 중 오류 발생: {exc}")
        return f"죄송합니다. 요청을 처리하는 중 오류가 발생했습니다: {exc}"
    except Exception as exc:  # pragma: no cover - 방어적 예외 처리
        print(f"에이전트 실행 중 예기치 않은 오류 발생: {exc}")
        return "죄송합니다. 요청을 처리하는 중 알 수 없는 오류가 발생했습니다."
