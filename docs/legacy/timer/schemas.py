"""
Timer 서버 Pydantic 스키마
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class TimerStatus(str, Enum):
    """타이머 상태"""
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TimerCreateRequest(BaseModel):
    """타이머 생성 요청"""
    duration_sec: int = Field(
        ..., 
        ge=1, 
        le=7200,
        description="타이머 시간 (초, 최대 2시간)"
    )
    label: str = Field(..., description="타이머 레이블 (예: '소고기 볶기')")
    recipe_id: Optional[str] = Field(None, description="연관된 레시피 ID")
    step_order: Optional[int] = Field(None, description="연관된 단계 번호")
    auto_start: bool = Field(True, description="생성 즉시 시작 여부")
    
    class Config:
        json_schema_extra = {
            "example": {
                "duration_sec": 600,
                "label": "소고기 볶기",
                "recipe_id": "recipe_001",
                "step_order": 3,
                "auto_start": True
            }
        }


class TimerResponse(BaseModel):
    """타이머 응답"""
    timer_id: str = Field(..., description="타이머 고유 ID")
    duration_sec: int = Field(..., description="총 시간 (초)")
    remaining_sec: int = Field(..., description="남은 시간 (초)")
    elapsed_sec: int = Field(..., description="경과 시간 (초)")
    status: TimerStatus = Field(..., description="타이머 상태")
    label: str = Field(..., description="타이머 레이블")
    started_at: Optional[str] = Field(None, description="시작 시각 (ISO)")
    completed_at: Optional[str] = Field(None, description="완료 시각 (ISO)")
    progress_percent: float = Field(..., description="진행률 (%)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "timer_id": "abc-123",
                "duration_sec": 600,
                "remaining_sec": 300,
                "elapsed_sec": 300,
                "status": "running",
                "label": "소고기 볶기",
                "started_at": "2025-11-07T10:00:00",
                "completed_at": None,
                "progress_percent": 50.0
            }
        }


class TimerListResponse(BaseModel):
    """타이머 목록 응답"""
    timers: list[TimerResponse]
    total: int
    active_count: int