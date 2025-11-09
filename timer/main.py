"""
Timer MCP 서버 - FastAPI
포트8101
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .models import TimerManager
from .schemas import (
    TimerCreateRequest, 
    TimerResponse, 
    TimerListResponse
)
from .config import TimerConfig

# 설정 검증
TimerConfig.validate()

# FastAPI 앱 생성
app = FastAPI(
    title="Yorijori Timer Server",
    description="요리조리 타이머 MCP 서버 - 독립 실행",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timer Manager 초기화
timer_manager = TimerManager()


@app.get("/")
async def root():
    """헬스 체크"""
    return {
        "service": "Yorijori Timer Server",
        "status": "running",
        "version": "1.0.0",
        "active_timers": len(timer_manager.get_active_timers()),
        "endpoints": [
            "POST /timers - 타이머 생성",
            "GET /timers - 모든 타이머 조회",
            "GET /timers/{id} - 특정 타이머 조회",
            "POST /timers/{id}/pause - 일시정지",
            "POST /timers/{id}/resume - 재개",
            "DELETE /timers/{id} - 취소"
        ]
    }


@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "active_timers": len(timer_manager.get_active_timers()),
        "total_timers": len(timer_manager.timers)
    }


@app.post("/timers", response_model=TimerResponse)
async def create_timer(request: TimerCreateRequest):
    """
    타이머 생성
    
    Args:
        request: 타이머 생성 요청
            - duration_sec: 타이머 시간 (초)
            - label: 타이머 레이블
            - recipe_id: (선택) 레시피 ID
            - step_order: (선택) 단계 번호
            - auto_start: (선택) 자동 시작 여부
    
    Returns:
        TimerResponse: 생성된 타이머 정보
    """
    try:
        timer = timer_manager.create_timer(
            duration_sec=request.duration_sec,
            label=request.label,
            recipe_id=request.recipe_id,
            step_order=request.step_order,
            auto_start=request.auto_start
        )
        
        return TimerResponse(**timer.to_dict())
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"타이머 생성 실패: {str(e)}")


@app.get("/timers/{timer_id}", response_model=TimerResponse)
async def get_timer(timer_id: str):
    """특정 타이머 조회"""
    timer = timer_manager.get_timer(timer_id)
    
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    
    return TimerResponse(**timer.to_dict())


@app.get("/timers", response_model=TimerListResponse)
async def get_all_timers():
    """모든 타이머 조회"""
    all_timers = timer_manager.get_all_timers()
    active_timers = timer_manager.get_active_timers()
    
    return TimerListResponse(
        timers=all_timers,
        total=len(all_timers),
        active_count=len(active_timers)
    )


@app.post("/timers/{timer_id}/pause")
async def pause_timer(timer_id: str):
    """타이머 일시정지"""
    timer = timer_manager.get_timer(timer_id)
    
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    
    timer_manager.pause_timer(timer_id)
    
    return {
        "success": True,
        "message": "타이머를 일시정지했어요",
        "timer": timer.to_dict()
    }


@app.post("/timers/{timer_id}/resume")
async def resume_timer(timer_id: str):
    """타이머 재개"""
    timer = timer_manager.get_timer(timer_id)
    
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    
    timer_manager.resume_timer(timer_id)
    
    return {
        "success": True,
        "message": "타이머를 다시 시작했어요",
        "timer": timer.to_dict()
    }


@app.delete("/timers/{timer_id}")
async def delete_timer(timer_id: str):
    """타이머 취소"""
    timer = timer_manager.get_timer(timer_id)
    
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    
    timer_manager.cancel_timer(timer_id)
    
    return {
        "success": True,
        "message": "타이머를 취소했어요"
    }


# 서버 실행 함수
def start_server():
    """Timer 서버 시작 (개발용)"""
    uvicorn.run(
        "timer.main:app",
        host=TimerConfig.HOST,
        port=TimerConfig.PORT,
        reload=True
    )


if __name__ == "__main__":
    start_server()
