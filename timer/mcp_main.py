"""
Timer MCP 서버 - MCP Protocol 지원
LangChain Agent가 MCP로 호출할 경우
"""

import asyncio
import json
from typing import Any
from mcp.server import Server
from mcp.types import Tool, TextContent

from .models import TimerManager
from .config import TimerConfig

# 설정 검증
TimerConfig.validate()

# MCP 서버 생성
app = Server("yorijori-timer-server")

# Timer Manager 초기화
timer_manager = TimerManager()


@app.list_tools()
async def list_tools() -> list[Tool]:
    """사용 가능한 Tool 목록 반환"""
    return [
        Tool(
            name="timer_create",
            description="타이머를 생성하고 시작합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "duration_sec": {
                        "type": "integer",
                        "description": "타이머 시간 (초)"
                    },
                    "label": {
                        "type": "string",
                        "description": "타이머 레이블"
                    }
                },
                "required": ["duration_sec", "label"]
            }
        ),
        Tool(
            name="timer_check",
            description="타이머 상태를 확인합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "timer_id": {
                        "type": "string",
                        "description": "타이머 ID"
                    }
                },
                "required": ["timer_id"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Tool 실행"""
    
    if name == "timer_create":
        try:
            duration_sec = arguments.get("duration_sec")
            label = arguments.get("label")
            
            timer = timer_manager.create_timer(
                duration_sec=duration_sec,
                label=label,
                auto_start=True
            )
            
            result = {
                "success": True,
                "timer_id": timer.timer_id,
                "message": f"⏰ {label} 타이머를 시작했어요!"
            }
            
            return [TextContent(
                type="text",
                text=json.dumps(result, ensure_ascii=False)
            )]
        
        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": str(e)}, ensure_ascii=False)
            )]
    
    elif name == "timer_check":
        try:
            timer_id = arguments.get("timer_id")
            timer = timer_manager.get_timer(timer_id)
            
            if not timer:
                raise ValueError("Timer not found")
            
            return [TextContent(
                type="text",
                text=json.dumps(timer.to_dict(), ensure_ascii=False)
            )]
        
        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": str(e)}, ensure_ascii=False)
            )]
    
    return [TextContent(
        type="text",
        text=json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)
    )]


async def main():
    """MCP 서버 실행"""
    from mcp.server.stdio import stdio_server
    
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())