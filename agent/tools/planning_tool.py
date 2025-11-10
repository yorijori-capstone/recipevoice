"""
Planning 서버 호출 Tool
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type
import requests
import json


class PlanningInput(BaseModel):
    """Planning Tool 입력"""
    recipe_json: str = Field(..., description="레시피 JSON (문자열)")


class PlanningTool(BaseTool):
    """Planning 서버를 호출하는 Tool"""
    
    name: str = "planning_service"
    description: str = """
레시피를 음성 안내용 태스크 리스트로 변환합니다.

입력: recipe_json (JSON 문자열)
출력: planned_steps (태스크 리스트)
"""
    
    args_schema: Type[BaseModel] = PlanningInput
    planning_server_url: str = "http://localhost:8000"
    
    def _run(self, recipe_json: str) -> str:
        """Planning 서버 호출"""
        try:
            recipe_data = json.loads(recipe_json)
            
            response = requests.post(
                f"{self.planning_server_url}/plan",
                json=recipe_data,
                timeout=10
            )
            response.raise_for_status()
            
            return json.dumps(response.json(), ensure_ascii=False)
        
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "message": "Planning 서버 호출 실패"
            }, ensure_ascii=False)