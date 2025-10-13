import json
import os
from typing import Dict, List
import google.generativeai as genai
from .prompts import SYSTEM_PROMPT, create_planning_prompt


class LLMClient:
    """LLM API 호출 및 응답 처리 (Google Gemini)"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")
        
        # Gemini 설정
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def generate_plan(
        self, 
        title: str, 
        ingredients: List[Dict], 
        steps: List[Dict]
    ) -> Dict:
        """
        레시피 데이터를 받아 음성 안내용 스크립트 생성
        
        Args:
            title: 레시피 제목
            ingredients: 재료 목록 [{"name": "재료명", "quantity": "수량"}, ...]
            steps: 조리 단계 [{"order": 1, "instruction": "설명"}, ...]
        
        Returns:
            {
              "opening_remark": "...",
              "planned_steps": [...],
              "closing_remark": "..."
            }
        
        Raises:
            ValueError: LLM 응답 파싱 실패 시
        """
        
        # 프롬프트 생성
        user_prompt = create_planning_prompt(title, ingredients, steps)
        
        # System prompt와 user prompt 결합
        full_prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"
        
        try:
            # Gemini 호출
            response = self.model.generate_content(
                full_prompt,
                generation_config={
                    'temperature': 0.5,
                    'max_output_tokens': 8192,
                }
            )
            
            # 응답 텍스트 추출
            response_text = response.text
            
            # JSON 파싱
            plan_data = self._parse_json_response(response_text)
            
            # 필수 필드 검증
            self._validate_plan_data(plan_data)
            
            return plan_data
        
        except Exception as e:
            raise ValueError(f"LLM 응답 생성 실패: {str(e)}")
    
    def _parse_json_response(self, text: str) -> Dict:
        """
        LLM 응답에서 JSON 추출
        
        LLM이 ```json ... ``` 형태로 응답할 수 있으므로 처리
        """
        # 코드 블록 제거
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        text = text.strip()
        
        try:
            data = json.loads(text)
            return data
        
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON 파싱 실패: {str(e)}\n응답 내용:\n{text}")
    
    def _validate_plan_data(self, data: Dict):
        """
        응답 데이터 필수 필드 검증
        """
        required_fields = ["opening_remark", "planned_steps", "closing_remark"]
        
        for field in required_fields:
            if field not in data:
                raise ValueError(f"응답에 '{field}' 필드가 없습니다.")
        
        if not isinstance(data["planned_steps"], list):
            raise ValueError("'planned_steps'는 리스트여야 합니다.")
        
        if len(data["planned_steps"]) == 0:
            raise ValueError("'planned_steps'가 비어있습니다.")
        
        # 각 step 검증
        for step in data["planned_steps"]:
            if "order" not in step or "script" not in step:
                raise ValueError(
                    "각 step은 'order'와 'script' 필드를 가져야 합니다."
                )

    def generate_chat_response(self, user_input: str, chat_history: str) -> str:
        """
        사용자 입력과 대화 기록을 바탕으로 일반적인 대화 응답을 생성합니다.
        """
        full_prompt = f"{chat_history}\n\n사용자: {user_input}\n에이전트:"
        
        try:
            response = self.model.generate_content(
                full_prompt,
                generation_config={
                    'temperature': 0.7,
                    'max_output_tokens': 2048,
                }
            )
            return response.text
        except Exception as e:
            raise ValueError(f"LLM 채팅 응답 생성 실패: {str(e)}")


# 테스트용 함수
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    client = LLMClient()
    
    # 예시 레시피
    result = client.generate_plan(
        title="엄마의 레시피, 소고기 미역국 끓이는 법",
        ingredients=[
            {"name": "소고기 국거리용", "quantity": "180g"},
            {"name": "미역", "quantity": "20g"}
        ],
        steps=[
            {
                "order": 1,
                "instruction": "덩어리 고기를 사용할 경우, 고기의 결과 반대인 수직 방향으로 썰어주세요."
            },
            {
                "order": 2,
                "instruction": "미역 20g을 물에 불려주세요."
            }
        ]
    )
    
    print(json.dumps(result, ensure_ascii=False, indent=2))