"""
레시피 상태 추적 커스텀 메모리
"""

from langchain.memory import ConversationBufferMemory
from typing import Dict, List, Any
from pydantic import Field


class RecipeTrackingMemory(ConversationBufferMemory):
    """
    레시피 진행 상태를 추적하는 커스텀 메모리
    대화 기록 + 레시피 상태 통합 관리
    """
    
    recipe_data: Dict[str, Any] = Field(default_factory=dict)
    current_step: int = Field(default=0)
    total_steps: int = Field(default=0)
    task_list: List[Dict] = Field(default_factory=list)
    
    def save_recipe(self, recipe_id: str, task_list_response: Dict):
        """레시피 데이터 저장"""
        self.recipe_data[recipe_id] = task_list_response
        self.task_list = task_list_response.get("planned_steps", [])
        self.total_steps = len(self.task_list)
        self.current_step = 1
        print(f"✅ 레시피 저장: {recipe_id} ({self.total_steps}개 단계)")
    
    def get_current_task(self) -> Dict:
        """현재 단계의 태스크 반환"""
        if 0 < self.current_step <= len(self.task_list):
            return self.task_list[self.current_step - 1]
        return {}
    
    def next_step(self) -> Dict:
        """다음 단계로 이동"""
        if self.current_step < self.total_steps:
            self.current_step += 1
        
        task = self.get_current_task()
        return {
            "step": self.current_step,
            "total": self.total_steps,
            "task": task,
            "message": f"({self.current_step}/{self.total_steps})"
        }
    
    def previous_step(self) -> Dict:
        """이전 단계로 이동"""
        if self.current_step > 1:
            self.current_step -= 1
        
        task = self.get_current_task()
        return {
            "step": self.current_step,
            "total": self.total_steps,
            "task": task
        }
    
    def get_state(self) -> Dict:
        """현재 상태 반환"""
        return {
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_percent": round((self.current_step / self.total_steps) * 100, 1) if self.total_steps > 0 else 0,
            "current_task": self.get_current_task()
        }