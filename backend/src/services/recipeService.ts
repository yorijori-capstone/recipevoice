import { pool } from '../db/pool.js';

export interface Recipe {
  id: number;
  recipe_id: string;
  source_url: string;
  title: string;
  servings: string;
  cook_time: string;
  difficulty: string;
  tips: string[];
  copyright: string;
  created_at: Date;
  updated_at: Date;
}

export interface Ingredient {
  id: number;
  recipe_id: string;
  name: string;
  description: string | null;
  quantity: string;
  display_order: number;
}

export interface Step {
  id: number;
  recipe_id: string;
  step_number: number;
  description: string;
  image_url: string | null;
  duration: number | null;
}

export interface RecipeDetail extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
}

export class RecipeService {
  // 레시피 목록 가져오기
  async listRecipes(limit = 20, offset = 0): Promise<Recipe[]> {
    const result = await pool.query(
      `SELECT * FROM recipes 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  // 레시피 상세 정보 가져오기
  async getRecipeById(recipeId: string): Promise<RecipeDetail | null> {
    const recipeResult = await pool.query(
      'SELECT * FROM recipes WHERE recipe_id = $1',
      [recipeId]
    );

    if (recipeResult.rows.length === 0) {
      return null;
    }

    const recipe = recipeResult.rows[0];

    // 재료 가져오기
    const ingredientsResult = await pool.query(
      'SELECT * FROM ingredients WHERE recipe_id = $1 ORDER BY display_order',
      [recipeId]
    );

    // 조리 단계 가져오기
    const stepsResult = await pool.query(
      'SELECT * FROM steps WHERE recipe_id = $1 ORDER BY step_number',
      [recipeId]
    );

    return {
      ...recipe,
      ingredients: ingredientsResult.rows,
      steps: stepsResult.rows,
    };
  }

  // 레시피 검색 (제목 기반)
  async searchRecipes(query: string): Promise<Recipe[]> {
    const result = await pool.query(
      `SELECT * FROM recipes 
       WHERE title ILIKE $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [`%${query}%`]
    );
    return result.rows;
  }

  // 난이도로 필터링
  async filterByDifficulty(difficulty: string): Promise<Recipe[]> {
    const result = await pool.query(
      'SELECT * FROM recipes WHERE difficulty = $1 ORDER BY created_at DESC',
      [difficulty]
    );
    return result.rows;
  }

  // 재료로 검색
  async searchByIngredient(ingredientName: string): Promise<Recipe[]> {
    const result = await pool.query(
      `SELECT DISTINCT r.* FROM recipes r
       INNER JOIN ingredients i ON r.recipe_id = i.recipe_id
       WHERE i.name ILIKE $1
       ORDER BY r.created_at DESC`,
      [`%${ingredientName}%`]
    );
    return result.rows;
  }

  // 전체 레시피 개수
  async countRecipes(): Promise<number> {
    const result = await pool.query('SELECT COUNT(*) FROM recipes');
    return parseInt(result.rows[0].count);
  }
}