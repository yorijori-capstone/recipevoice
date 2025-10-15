"""
MCP 서버 실행 진입점
"""

import asyncio
from .mcp_main import main

if __name__ == "__main__":
    asyncio.run(main())