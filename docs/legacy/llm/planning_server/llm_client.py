import json
import os
from typing import Any, Dict, List

from openai import OpenAI

from .prompts import CHAT_SYSTEM_PROMPT, SYSTEM_PROMPT, create_planning_prompt


class LLMClient:
    """OpenAI Responses API를 사용해 플래닝/대화를 처리하는 클라이언트"""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        temperature: float = 0.5,
        max_output_tokens: int = 4096,
        chat_model: str | None = None,
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

        self.client = OpenAI(api_key=self.api_key)
        self.plan_model = model or os.getenv("PLANNING_MODEL", "gpt-4o-mini")
        self.chat_model = chat_model or self.plan_model
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens

    def generate_plan(
        self,
        title: str,
        ingredients: List[Dict],
        steps: List[Dict],
    ) -> Dict:
        user_prompt = create_planning_prompt(title, ingredients, steps)
        response = self.client.responses.create(
            model=self.plan_model,
            temperature=self.temperature,
            max_output_tokens=self.max_output_tokens,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
                {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
            ],
        )
        response_text = self._extract_response_text(response)
        plan_data = self._parse_json_response(response_text)
        self._validate_plan_data(plan_data)
        return plan_data

    def generate_chat_response(self, user_input: str, chat_history: str = "") -> str:
        history_text = chat_history.strip()
        if history_text:
            combined = f"이전 대화 기록:\n{history_text}\n\n사용자의 최신 요청:\n{user_input.strip()}"
        else:
            combined = user_input.strip()

        response = self.client.responses.create(
            model=self.chat_model,
            temperature=self.temperature,
            max_output_tokens=min(self.max_output_tokens, 2048),
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": CHAT_SYSTEM_PROMPT}]},
                {"role": "user", "content": [{"type": "input_text", "text": combined}]},
            ],
        )
        return self._extract_response_text(response)

    def _extract_response_text(self, response: Any) -> str:
        output_text = getattr(response, "output_text", None)
        if output_text:
            return output_text.strip()

        chunks: List[str] = []
        for item in getattr(response, "output", []) or []:
            for content in getattr(item, "content", []) or []:
                text_value = getattr(content, "text", None)
                if text_value:
                    chunks.append(text_value)
        if chunks:
            return "".join(chunks).strip()
        raise ValueError("LLM 응답에서 텍스트를 추출하지 못했습니다.")

    def _parse_json_response(self, text: str) -> Dict:
        if "```json" in text:
            text = text.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in text:
            text = text.split("```", 1)[1].split("```", 1)[0]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"JSON 파싱 실패: {exc}\n응답 내용:\n{text}") from exc

    def _validate_plan_data(self, data: Dict):
        required_fields = ["opening_remark", "planned_steps", "closing_remark"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"응답에 '{field}' 필드가 없습니다.")

        planned_steps = data.get("planned_steps")
        if not isinstance(planned_steps, list) or not planned_steps:
            raise ValueError("'planned_steps'는 비어 있지 않은 리스트여야 합니다.")

        for step in planned_steps:
            if not isinstance(step, dict):
                raise ValueError("각 step은 객체 형태여야 합니다.")
            if "order" not in step or "script" not in step:
                raise ValueError("각 step은 'order'와 'script' 필드를 가져야 합니다.")
