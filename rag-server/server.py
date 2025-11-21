"""Recipe RAG MCP Server."""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import json
from typing import Any

from tools.search import search_recipes, search_with_details
from tools.recipes import get_recipe_detail, get_recipes_by_ids

# Create MCP server
app = Server("recipe-rag")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="search_recipes",
            description="Search recipes by natural language query using semantic search (FAISS)",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language search query (e.g., '김치찌개', '30분 안에 만들 수 있는 요리')"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_recipe_detail",
            description="Get full recipe details including ingredients and cooking steps",
            inputSchema={
                "type": "object",
                "properties": {
                    "recipe_id": {
                        "type": "string",
                        "description": "Recipe ID (e.g., '913370')"
                    }
                },
                "required": ["recipe_id"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    
    if name == "search_recipes":
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 5)
        
        # Search
        results = search_with_details(query, top_k=top_k)
        
        # Get full info
        recipe_ids = [r['recipe_id'] for r in results]
        recipes = get_recipes_by_ids(recipe_ids)
        
        # Merge scores
        score_map = {r['recipe_id']: r['score'] for r in results}
        for recipe in recipes:
            recipe['search_score'] = score_map.get(recipe['recipe_id'], 0.0)
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "query": query,
                "total": len(recipes),
                "recipes": recipes
            }, ensure_ascii=False, indent=2)
        )]
    
    elif name == "get_recipe_detail":
        recipe_id = arguments.get("recipe_id", "")
        recipe = get_recipe_detail(recipe_id)
        
        if not recipe:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "Recipe not found"})
            )]
        
        return [TextContent(
            type="text",
            text=json.dumps(recipe, ensure_ascii=False, indent=2)
        )]
    
    else:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Unknown tool: {name}"})
        )]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    print("🚀 Starting Recipe RAG MCP Server...")
    asyncio.run(main())