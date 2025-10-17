import { MCPTool } from "mcp-framework";
import { z } from "zod";

const BASE_URL = process.env.RECIPE_RAG_BASE_URL || "http://127.0.0.1:8000";

type Input = { q: string; top_k?: number };

export default class RecipeSearch extends MCPTool<Input> {
  name = "recipe_search";
  description = "Search local recipe dataset (ingredients + name)";
  schema = {
    q: { type: z.string(), description: "검색할 요리명 또는 재료명" },
    top_k: { type: z.number().int().min(1).max(50).default(8), description: "검색 결과 개수" },
  };

  async execute(input: Input) {
    const u = new URL("/recipes/search/", BASE_URL);
    u.searchParams.set("q", input.q);
    if (input.top_k) {
      u.searchParams.set("top_k", String(input.top_k));
    }

    const r = await fetch(u.toString(), { method: "GET" });
    if (!r.ok) throw new Error(`/recipes/search failed (${r.status})`);

    return r.json();
  }
}


// import { MCPTool } from "mcp-framework";
// import { z } from "zod";
// import fs from "fs";

// type Input = { q: string };

// export default class RecipeSearch extends MCPTool<Input> {
//   name = "recipe_search";
//   description = "로컬 JSON에서 요리명 또는 재료명으로 레시피 검색";

//   schema = {
//     q: { type: z.string(), description: "검색어 (예: 미역국, 파스타)" },
//   };

//   async execute(input: Input) {
//     const filePath = "./snippets/recipes.json";
//     const q = input.q.toLowerCase();

//     try {
//       const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
//       const results = data.filter(
//         (r: any) =>
//           r.title.toLowerCase().includes(q) ||
//           r.ingredients.some((i: string) => i.toLowerCase().includes(q))
//       );

//       if (results.length === 0) {
//         return [{ message: "검색 결과 없음" }];
//       }

//       return results.map((r: any) => ({
//         recipe_id: r.recipe_id,
//         title: r.title,
//         cook_time: r.cook_time,
//         difficulty: r.difficulty,
//         source_url: r.source_url,
//       }));
//     } catch (err: any) {
//       return [{ error: `파일 읽기 오류: ${err.message}` }];
//     }
//   }
// }
