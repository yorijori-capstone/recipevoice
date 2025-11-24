"""
MCP 서버 테스트 클라이언트
"""

import asyncio
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def test_planning_tools():
    """플래닝 Tools 테스트"""
    
    server_params = StdioServerParameters(
        command="poetry",
        args=["run", "python", "-m", "llm.planning_server.mcp_main"],
        env=None
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Tool 목록 확인
            tools_response = await session.list_tools()
            print("📋 사용 가능한 Tools:")
            
            if hasattr(tools_response, 'tools'):
                tools = tools_response.tools
            else:
                tools = tools_response
            
            for tool in tools:
                if isinstance(tool, tuple):
                    tool_name = tool[0] if len(tool) > 0 else "unknown"
                    tool_desc = tool[1] if len(tool) > 1 else "no description"
                    print(f"  - {tool_name}: {tool_desc[:60]}...")
                else:
                    print(f"  - {tool.name}: {tool.description[:60]}...")
            
            # ===== 테스트 1: plan_recipe =====
            print("\n🔧 Test 1: plan_recipe Tool 실행...")
            
            try:
                result = await session.call_tool(
                    "plan_recipe",
                    arguments={
                        "title": "김치찌개",
                        "ingredients": [
                            {"name": "김치", "quantity": "300g"},
                            {"name": "돼지고기", "quantity": "200g"}
                        ],
                        "steps": [
                            {"order": 1, "instruction": "재료를 준비합니다."},
                            {"order": 2, "instruction": "냄비에 볶습니다."}
                        ]
                    }
                )
                
                print("\n✅ plan_recipe 결과:")
                for content in result.content:
                    if content.type == "text":
                        try:
                            data = json.loads(content.text)
                            print(f"  - 레시피: {data.get('title', 'N/A')}")
                            print(f"  - 단계 수: {len(data.get('planned_steps', []))}")
                            if data.get('planned_steps'):
                                first_step = data['planned_steps'][0]
                                print(f"  - 첫 단계 script: {first_step.get('script', '')[:50]}...")
                                print(f"  - 타이머 필요: {first_step.get('timer_required', False)}")
                        except json.JSONDecodeError:
                            print(content.text[:100])
            
            except Exception as e:
                print(f"\n❌ plan_recipe 에러: {e}")
            
            # ===== 테스트 2: handle_control_command =====
            print("\n🔧 Test 2: handle_control_command Tool 실행...")
            
            try:
                result = await session.call_tool(
                    "handle_control_command",
                    arguments={
                        "command": "retry",
                        "current_step_order": 1,
                        "current_step": {
                            "order": 1,
                            "script": "테스트 스크립트",
                            "retry_script": "다시 설명드릴게요",
                            "fallback_script": "쉽게 설명하면",
                            "pause_hint": "잠시 멈췄습니다",
                            "estimated_time_sec": 60,
                            "timer_required": False,
                            "timer_message": ""
                        }
                    }
                )
                
                print("\n✅ handle_control_command 결과:")
                for content in result.content:
                    if content.type == "text":
                        try:
                            data = json.loads(content.text)
                            print(f"  - 명령: {data.get('command', 'N/A')}")
                            print(f"  - 메시지: {data.get('message', 'N/A')}")
                            print(f"  - 액션: {data.get('action', 'N/A')}")
                        except json.JSONDecodeError:
                            print(content.text[:100])
            
            except Exception as e:
                print(f"\n❌ handle_control_command 에러: {e}")


if __name__ == "__main__":
    asyncio.run(test_planning_tools())