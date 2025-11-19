"""
MCP 서버 진입점
LangChain Agent가 호출할 수 있는 Tool로 작동
"""

import json
import asyncio
from typing import Any, Literal
from mcp.server import Server
from mcp.types import Tool, TextContent

from .llm_client import LLMClient
from .config import Config

# 설정 검증
Config.validate()

# MCP 서버 생성
app = Server("yorijori-planning-server")

# LLM 클라이언트 초기화
llm_client = LLMClient(api_key=Config.OPENAI_API_KEY)


@app.list_tools()
async def list_tools() -> list[Tool]:
    """사용 가능한 Tool 목록 반환"""
    return [
        Tool(
            name="plan_recipe",
            description="레시피를 음성 안내용 대화 스크립트로 변환합니다. 초보자도 따라할 수 있도록 친절하고 자연스러운 대화체로 변환하며, 예외 처리와 타이머 기능을 포함합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "레시피 제목"
                    },
                    "ingredients": {
                        "type": "array",
                        "description": "재료 목록",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "quantity": {"type": "string"}
                            },
                            "required": ["name", "quantity"]
                        }
                    },
                    "steps": {
                        "type": "array",
                        "description": "조리 단계",
                        "items": {
                            "type": "object",
                            "properties": {
                                "order": {"type": "integer"},
                                "instruction": {"type": "string"}
                            },
                            "required": ["order", "instruction"]
                        }
                    }
                },
                "required": ["title", "ingredients", "steps"]
            }
        ),
        Tool(
            name="handle_control_command",
            description="사용자의 제어 명령(멈춰, 계속, 다시, 뭐라고?)을 처리합니다. 현재 진행 중인 단계 정보를 받아서 적절한 응답을 반환합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "enum": ["pause", "resume", "retry", "clarify"],
                        "description": "제어 명령: pause=멈춰, resume=계속, retry=다시, clarify=뭐라고?"
                    },
                    "current_step_order": {
                        "type": "integer",
                        "description": "현재 진행 중인 단계 번호"
                    },
                    "current_step": {
                        "type": "object",
                        "description": "현재 단계의 전체 정보",
                        "properties": {
                            "order": {"type": "integer"},
                            "script": {"type": "string"},
                            "retry_script": {"type": "string"},
                            "fallback_script": {"type": "string"},
                            "pause_hint": {"type": "string"},
                            "estimated_time_sec": {"type": "integer"},
                            "timer_required": {"type": "boolean"},
                            "timer_message": {"type": "string"}
                        },
                        "required": ["order", "script", "retry_script", "fallback_script"]
                    }
                },
                "required": ["command", "current_step_order", "current_step"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Tool 실행"""
    
    if name == "plan_recipe":
        try:
            # 입력 검증
            title = arguments.get("title")
            ingredients = arguments.get("ingredients", [])
            steps = arguments.get("steps", [])
            
            if not title or not ingredients or not steps:
                raise ValueError("title, ingredients, steps는 필수입니다.")
            
            # LLM 호출
            result = llm_client.generate_plan(
                title=title,
                ingredients=ingredients,
                steps=steps
            )
            
            # 결과를 JSON 문자열로 변환
            result_json = json.dumps(result, ensure_ascii=False, indent=2)
            
            return [
                TextContent(
                    type="text",
                    text=result_json
                )
            ]
        
        except Exception as e:
            error_msg = f"플래닝 생성 실패: {str(e)}"
            return [
                TextContent(
                    type="text",
                    text=json.dumps({"error": error_msg}, ensure_ascii=False)
                )
            ]
    
    elif name == "handle_control_command":
        try:
            command = arguments.get("command")
            step_order = arguments.get("current_step_order")
            step = arguments.get("current_step")
            
            if not command or not step:
                raise ValueError("command와 current_step은 필수입니다.")
            
            # 명령어별 응답 생성
            response = {
                "command": command,
                "step_order": step_order,
                "message": "",
                "action": ""
            }
            
            if command == "pause":
                response["message"] = step.get("pause_hint", "잠시 멈췄습니다.")
                response["action"] = "TTS를 일시정지하고 사용자 입력 대기"
            
            elif command == "resume":
                response["message"] = f"다시 시작할게요. {step.get('script', '')}"
                response["action"] = "현재 단계 script를 처음부터 다시 재생"
            
            elif command == "retry":
                response["message"] = step.get("retry_script", "다시 설명드릴게요.")
                response["action"] = "retry_script를 재생"
            
            elif command == "clarify":
                response["message"] = step.get("fallback_script", "쉽게 설명드릴게요.")
                response["action"] = "fallback_script를 재생"
            
            result_json = json.dumps(response, ensure_ascii=False, indent=2)
            
            return [
                TextContent(
                    type="text",
                    text=result_json
                )
            ]
        
        except Exception as e:
            error_msg = f"제어 명령 처리 실패: {str(e)}"
            return [
                TextContent(
                    type="text",
                    text=json.dumps({"error": error_msg}, ensure_ascii=False)
                )
            ]
    
    else:
        return [
            TextContent(
                type="text",
                text=json.dumps({"error": f"알 수 없는 tool: {name}"}, ensure_ascii=False)
            )
        ]


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