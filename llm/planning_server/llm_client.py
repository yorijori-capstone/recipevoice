import json
import os
import re
from typing import Dict, List
from openai import OpenAI
from .prompts import SYSTEM_PROMPT, create_planning_prompt


class LLMClient:
    """LLM API 호출 및 응답 처리 (OpenAI GPT-4o-mini)"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
        
        # OpenAI 클라이언트 초기화
        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o-mini"
    
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
        
        # 재시도 로직 (최대 3번)
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                print(f"🔄 LLM 호출 시도 {attempt + 1}/{max_retries}...")
                
                # GPT-4o-mini 호출
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=4096,
                    response_format={"type": "json_object"}
                )
                
                # 응답 텍스트 추출
                response_text = response.choices[0].message.content
                
                # 빈 응답 체크
                if not response_text or response_text.strip() == "":
                    print(f"⚠️  빈 응답 받음. 재시도 중...")
                    last_error = ValueError("LLM이 빈 응답을 반환했습니다.")
                    continue
                
                print(f"✅ 응답 받음: {len(response_text)} 글자")
                
                # JSON 파싱
                plan_data = self._parse_json_response(response_text)
                
                # 필수 필드 검증
                self._validate_plan_data(plan_data)
                
                print(f"✅ 검증 완료")
                return plan_data
            
            except json.JSONDecodeError as e:
                last_error = ValueError(f"JSON 파싱 실패 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                print(f"⚠️  {last_error}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2)
                continue
            
            except Exception as e:
                last_error = e
                print(f"⚠️  에러 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2)
                continue
        
        # 모든 재시도 실패
        raise ValueError(f"LLM 응답 생성 실패 (모든 재시도 실패): {str(last_error)}")
    
    def generate_chat_response(
        self, 
        user_input: str, 
        chat_history: str = ""
    ) -> str:
        """
        일반 대화 응답 생성 (Agent용)
        """
        try:
            messages = [
                {"role": "system", "content": "당신은 친절한 요리 도우미 AI입니다."}
            ]
            
            if chat_history:
                messages.append({"role": "assistant", "content": chat_history})
            
            messages.append({"role": "user", "content": user_input})
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise ValueError(f"채팅 응답 생성 실패: {str(e)}")
    
    def _parse_json_response(self, text: str) -> Dict:
        """LLM 응답에서 JSON 추출"""
        text = text.strip()
        
        try:
            data = json.loads(text)
            return data
        
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON 파싱 실패: {str(e)}\n응답 내용:\n{text}")
    
    def _validate_plan_data(self, data: Dict):
        """응답 데이터 필수 필드 검증"""
        required_fields = ["opening_remark", "planned_steps", "closing_remark"]
        
        for field in required_fields:
            if field not in data:
                raise ValueError(f"❌ 필수 필드 누락: '{field}'")
        
        if not isinstance(data["planned_steps"], list):
            raise ValueError("❌ 'planned_steps'는 리스트여야 합니다.")
        
        if len(data["planned_steps"]) == 0:
            raise ValueError("❌ 'planned_steps'가 비어있습니다.")
        
        required_step_fields = [
            "order", "script", "retry_script", "fallback_script",
            "estimated_time_sec", "timer_required", "timer_message"
        ]
        
        for i, step in enumerate(data["planned_steps"], 1):
            for field in required_step_fields:
                if field not in step:
                    raise ValueError(f"❌ {i}번째 step에 '{field}' 필드 없음")
            
            if not isinstance(step["order"], int):
                raise ValueError(f"❌ {i}번째 step의 order는 정수여야 함")
            
            if not isinstance(step["timer_required"], bool):
                raise ValueError(f"❌ {i}번째 step의 timer_required는 bool이어야 함")
            
            if not isinstance(step["estimated_time_sec"], int):
                raise ValueError(f"❌ {i}번째 step의 estimated_time_sec는 정수여야 함")
            
            # 영문자 포함 검증 (발음 규칙 위반 체크)
            for field in ["script", "retry_script", "fallback_script", "timer_message"]:
                text = step.get(field, "")
                if re.search(r'[a-zA-Z]{2,}', text):
                    allowed_words = []
                    words = re.findall(r'[a-zA-Z]+', text)
                    for word in words:
                        if word.lower() not in allowed_words:
                            raise ValueError(
                                f"❌ {i}번째 step의 {field}에 영문자 포함됨: '{word}' in '{text}'"
                            )


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    client = LLMClient()
    
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