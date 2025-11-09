"""
Timer 서버 호출 Tool
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Type
import requests
import json


class TimerCreateInput(BaseModel):
    duration_sec: int = Field(..., description="타이머 시간 (초)")
    label: str = Field(..., description="타이머 레이블")


class TimerCreateTool(BaseTool):
    """타이머 생성 Tool"""
    
    name: str = "timer_create"
    description: str = "타이머를 생성하고 시작합니다."
    args_schema: Type[BaseModel] = TimerCreateInput
    timer_server_url: str = "http://localhost:8101"
    
    def _run(self, duration_sec: int, label: str) -> str:
        try:
            response = requests.post(
                f"{self.timer_server_url}/timers",
                json={
                    "duration_sec": duration_sec,
                    "label": label,
                    "auto_start": True
                },
                timeout=5
            )
            response.raise_for_status()
            timer = response.json()
            
            minutes = duration_sec // 60
            seconds = duration_sec % 60
            time_str = f"{minutes}분 {seconds}초" if minutes > 0 else f"{seconds}초"
            
            return json.dumps({
                "success": True,
                "timer_id": timer["timer_id"],
                "message": f"⏰ {time_str} 타이머 시작!"
            }, ensure_ascii=False)
        
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)


class TimerCheckTool(BaseTool):
    """타이머 상태 확인 Tool"""
    
    name: str = "timer_check"
    description: str = "타이머 상태를 확인합니다."
    timer_server_url: str = "http://localhost:8101"
    
    def _run(self, timer_id: str) -> str:
        try:
            response = requests.get(
                f"{self.timer_server_url}/timers/{timer_id}",
                timeout=5
            )
            response.raise_for_status()
            return json.dumps(response.json(), ensure_ascii=False)
        
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)


def create_timer_tools(timer_server_url: str = "http://localhost:8101") -> list:
    """Timer Tools 생성"""
    return [
        TimerCreateTool(timer_server_url=timer_server_url),
        TimerCheckTool(timer_server_url=timer_server_url)
    ]
