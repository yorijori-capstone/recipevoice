"""
Timer 핵심 로직
"""

from typing import Optional, Dict, Callable
from datetime import datetime
import threading
import uuid
from .schemas import TimerStatus


class Timer:
    """개별 타이머 객체"""
    
    def __init__(
        self, 
        timer_id: str, 
        duration_sec: int, 
        label: str,
        recipe_id: Optional[str] = None,
        step_order: Optional[int] = None
    ):
        self.timer_id = timer_id
        self.duration_sec = duration_sec
        self.label = label
        self.recipe_id = recipe_id
        self.step_order = step_order
        
        self.status = TimerStatus.RUNNING
        self.started_at = datetime.now()
        self.paused_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.paused_duration_sec = 0  # 일시정지된 총 시간
        
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
    
    def start(self, on_complete: Optional[Callable] = None):
        """타이머 시작 (백그라운드 스레드)"""
        def run():
            import time
            elapsed = 0
            while elapsed < self.duration_sec and not self._stop_event.is_set():
                if self.status == TimerStatus.RUNNING:
                    time.sleep(1)
                    elapsed += 1
                elif self.status == TimerStatus.PAUSED:
                    time.sleep(0.1)  # 일시정지 중 대기
            
            if not self._stop_event.is_set():
                self.status = TimerStatus.COMPLETED
                self.completed_at = datetime.now()
                
                if on_complete:
                    on_complete(self)
        
        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()
    
    def pause(self):
        """일시정지"""
        if self.status == TimerStatus.RUNNING:
            self.status = TimerStatus.PAUSED
            self.paused_at = datetime.now()
    
    def resume(self):
        """재개"""
        if self.status == TimerStatus.PAUSED:
            self.status = TimerStatus.RUNNING
            if self.paused_at:
                pause_duration = (datetime.now() - self.paused_at).total_seconds()
                self.paused_duration_sec += pause_duration
            self.paused_at = None
    
    def cancel(self):
        """취소"""
        self.status = TimerStatus.CANCELLED
        self._stop_event.set()
    
    def get_remaining_sec(self) -> int:
        """남은 시간 계산"""
        if self.status == TimerStatus.COMPLETED:
            return 0
        
        elapsed = (datetime.now() - self.started_at).total_seconds() - self.paused_duration_sec
        remaining = max(0, self.duration_sec - int(elapsed))
        return remaining
    
    def get_elapsed_sec(self) -> int:
        """경과 시간 계산"""
        elapsed = (datetime.now() - self.started_at).total_seconds() - self.paused_duration_sec
        return min(int(elapsed), self.duration_sec)
    
    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        remaining = self.get_remaining_sec()
        elapsed = self.get_elapsed_sec()
        progress = round((elapsed / self.duration_sec) * 100, 1) if self.duration_sec > 0 else 0
        
        return {
            "timer_id": self.timer_id,
            "duration_sec": self.duration_sec,
            "remaining_sec": remaining,
            "elapsed_sec": elapsed,
            "status": self.status.value,
            "label": self.label,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress_percent": progress
        }


class TimerManager:
    """타이머 관리자 (다중 타이머 동시 관리)"""
    
    def __init__(self):
        self.timers: Dict[str, Timer] = {}
    
    def create_timer(
        self, 
        duration_sec: int, 
        label: str,
        recipe_id: Optional[str] = None,
        step_order: Optional[int] = None,
        auto_start: bool = True
    ) -> Timer:
        """타이머 생성"""
        timer_id = str(uuid.uuid4())
        timer = Timer(
            timer_id=timer_id,
            duration_sec=duration_sec,
            label=label,
            recipe_id=recipe_id,
            step_order=step_order
        )
        
        self.timers[timer_id] = timer
        
        if auto_start:
            timer.start(on_complete=self._on_timer_complete)
        
        print(f"⏰ 타이머 생성: {label} ({duration_sec}초)")
        
        return timer
    
    def get_timer(self, timer_id: str) -> Optional[Timer]:
        """타이머 조회"""
        return self.timers.get(timer_id)
    
    def pause_timer(self, timer_id: str):
        """타이머 일시정지"""
        timer = self.timers.get(timer_id)
        if timer:
            timer.pause()
    
    def resume_timer(self, timer_id: str):
        """타이머 재개"""
        timer = self.timers.get(timer_id)
        if timer:
            timer.resume()
    
    def cancel_timer(self, timer_id: str):
        """타이머 취소"""
        timer = self.timers.get(timer_id)
        if timer:
            timer.cancel()
            del self.timers[timer_id]
    
    def get_all_timers(self) -> list:
        """모든 타이머 조회"""
        return [timer.to_dict() for timer in self.timers.values()]
    
    def get_active_timers(self) -> list:
        """진행 중인 타이머만 조회"""
        return [
            timer.to_dict() 
            for timer in self.timers.values() 
            if timer.status == TimerStatus.RUNNING
        ]
    
    def _on_timer_complete(self, timer: Timer):
        """타이머 완료 콜백"""
        print(f"✅ 타이머 완료: {timer.label}")
        
        # TODO: MCP HOST에 이벤트 발행 (선택적)
        # 예: WebSocket, HTTP callback 등