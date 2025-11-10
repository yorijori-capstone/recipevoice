import "dotenv/config";
import { MCPServer } from "mcp-framework";

async function main(): Promise<void> {
  try {
    const server = new MCPServer();
    await server.start();
    console.log("✅ RecipeRAG MCP server started successfully");
  } catch (err) {
    console.error("❌ RecipeRAG MCP server failed to start:", err);
    process.exit(1);
  }
}

main();