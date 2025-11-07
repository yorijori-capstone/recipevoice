import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 8040; // MCP 서버용 포트
const BASE_URL = process.env.RECIPE_RAG_BASE_URL || "http://127.0.0.1:8030";

// 간단한 health check
app.get("/", (_, res) => {
  res.send("✅ RecipeRAG MCP Express Server is running");
});

// /recipes/search?q=...&top_k=...
app.get("/recipes/search", async (req, res) => {
  const q = req.query.q as string;
  const top_k = req.query.top_k || "8";

  if (!q) {
    return res.status(400).json({ error: "Missing 'q' parameter" });
  }

  try {
    const url = new URL("/rag/recipes", BASE_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("top_k", String(top_k));

    const r = await fetch(url.toString());
    if (!r.ok) {
      return res.status(r.status).json({ error: `Backend error ${r.status}` });
    }

    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    console.error("❌ Recipe search failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// /chunks/search?q=...&top_k=...
app.get("/chunks/search", async (req, res) => {
  const q = req.query.q as string;
  const top_k = req.query.top_k || "8";

  if (!q) {
    return res.status(400).json({ error: "Missing 'q' parameter" });
  }

  try {
    const url = new URL("/rag/chunks", BASE_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("top_k", String(top_k));

    const r = await fetch(url.toString());
    if (!r.ok) {
      return res.status(r.status).json({ error: `Backend error ${r.status}` });
    }

    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    console.error("❌ Chunk search failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ RecipeRAG Express MCP server running on http://127.0.0.1:${PORT}`);
});


// import "dotenv/config";
// import { MCPServer } from "mcp-framework";
// import RecipeSearch from "./tools/RecipeSearch.js"; // ✅ 확장자 추가

// async function main(): Promise<void> {
//   try {
//     // ✅ 타입 무시하고 tools 옵션 사용
//     const server = new MCPServer({
//       // @ts-ignore
//       tools: [new RecipeSearch()],
//     });

//     await server.start();
//     console.log("✅ RecipeRAG MCP server started successfully with RecipeSearch tool");
//   } catch (err) {
//     console.error("❌ RecipeRAG MCP server failed to start:", err);
//     process.exit(1);
//   }
// }

// main();



// import "dotenv/config";
// import { MCPServer } from "mcp-framework";

// async function main(): Promise<void> {
//   try {
//     const server = new MCPServer();
//     await server.start();
//     console.log("✅ RecipeRAG MCP server started successfully");
//   } catch (err) {
//     console.error("❌ RecipeRAG MCP server failed to start:", err);
//     process.exit(1);
//   }
// }

// main();