import express from 'express';
import { RecipeService } from '../services/recipeService.js';
import { RecipeCreator } from '../services/recipeCreator.js';
import { RecipeCleaner } from '../services/recipeCleaner.js';
import { pool } from '../db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const recipeService = new RecipeService();
const recipeCreator = new RecipeCreator(process.env.OPENAI_API_KEY || '');
const recipeCleaner = new RecipeCleaner(process.env.OPENAI_API_KEY || '');

// 레시피 목록
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const recipes = await recipeService.listRecipes(limit, offset);
    const total = await recipeService.countRecipes();

    res.json({
      recipes,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// 레시피 검색 (cleaned recipes - V3: 제목 + 재료 + 세부 레시피)
// IMPORTANT: Must be before /:recipeId/cleaned to avoid route conflict
router.get('/search/cleaned', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    console.log(`[Recipe Search] Searching cleaned recipes for: "${query}"`);

    // Search in title, difficulty, cook_time, ingredients, and recipe steps using subqueries for better performance
    const result = await pool.query(
      `SELECT cr.id, cr.recipe_id, cr.title, cr.opening_remark,
              r.difficulty, r.cook_time, r.servings,
              (SELECT COUNT(*) FROM cleaned_steps WHERE cleaned_recipe_id = cr.id) as total_steps,
              CASE
                WHEN cr.title ILIKE $1 THEN 1
                WHEN r.difficulty ILIKE $1 THEN 2
                WHEN r.cook_time ILIKE $1 THEN 3
                WHEN EXISTS (SELECT 1 FROM ingredients i WHERE i.recipe_id = cr.recipe_id AND i.name ILIKE $1) THEN 4
                WHEN EXISTS (SELECT 1 FROM cleaned_steps cs WHERE cs.cleaned_recipe_id = cr.id AND cs.script ILIKE $1) THEN 5
                ELSE 6
              END as match_priority
       FROM cleaned_recipes cr
       LEFT JOIN recipes r ON cr.recipe_id = r.recipe_id
       WHERE cr.title ILIKE $1
          OR r.difficulty ILIKE $1
          OR r.cook_time ILIKE $1
          OR EXISTS (SELECT 1 FROM ingredients i WHERE i.recipe_id = cr.recipe_id AND i.name ILIKE $1)
          OR EXISTS (SELECT 1 FROM cleaned_steps cs WHERE cs.cleaned_recipe_id = cr.id AND cs.script ILIKE $1)
       ORDER BY match_priority, cr.created_at DESC
       LIMIT 20`,
      [`%${query}%`]
    );

    const recipes = result.rows.map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      title: row.title,
      openingRemark: row.opening_remark,
      difficulty: row.difficulty,
      cookTime: row.cook_time,
      servings: row.servings,
      totalSteps: row.total_steps,
    }));

    console.log(`[Recipe Search] Found ${recipes.length} cleaned recipes`);

    res.json({
      success: true,
      query,
      count: recipes.length,
      hasResults: recipes.length > 0,
      recipes,
    });
  } catch (error) {
    console.error('[Recipe Search] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search recipes'
    });
  }
});

// 레시피 상세 (cleaned recipe)
router.get('/:recipeId/cleaned', async (req, res) => {
  try {
    const { recipeId } = req.params;

    console.log(`[Recipe API] Getting cleaned recipe: ${recipeId}`);

    const cleanedRecipe = await recipeCleaner.getCleanedRecipe(recipeId);
    if (!cleanedRecipe) {
      return res.status(404).json({
        error: 'Cleaned recipe not found',
        message: `Recipe ${recipeId} has not been cleaned yet. Run cleaning first.`
      });
    }

    res.json({
      success: true,
      recipe: cleanedRecipe
    });
  } catch (error: any) {
    console.error('[Recipe API] Error fetching cleaned recipe:', error);
    res.status(500).json({
      error: 'Failed to fetch cleaned recipe',
      message: error.message
    });
  }
});

// 레시피 상세 (cleaned recipe 우선, 없으면 raw recipe)
router.get('/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    
    // 먼저 cleaned recipe 확인
    const cleanedRecipe = await recipeCleaner.getCleanedRecipe(recipeId);
    
    if (cleanedRecipe && cleanedRecipe.planning_result) {
      // cleaned recipe가 있으면 planning_result에서 데이터 추출하여 프론트엔드 형식으로 변환
      const planning = cleanedRecipe.planning_result;
      
      // recipes 테이블에서 메타 정보 가져오기
      const recipeInfo = await pool.query(
        'SELECT copyright, source_url, servings, cook_time, difficulty FROM recipes WHERE recipe_id = $1',
        [recipeId]
      );

      const recipeRow = recipeInfo.rows[0];
      let copyright = recipeRow?.copyright || null;
      let sourceUrl = recipeRow?.source_url || null;
      let servings = recipeRow?.servings || null;
      let cookTime = recipeRow?.cook_time || null;
      let difficulty = recipeRow?.difficulty || null;
      
      // 새로 생성한 레시피인지 확인 (recipe_id가 recipe_gen_으로 시작)
      const isGenerated = recipeId.startsWith('recipe_gen_');
      
      // 출처 설정
      if (isGenerated) {
        copyright = 'Recipe by Recipe Creator';
      } else if (copyright) {
        copyright = `Recipe by ${copyright}`;
      } else {
        copyright = 'Recipe by 알 수 없음';
      }
      
      // ingredients 변환 (planning_result.ingredients -> 프론트엔드 형식)
      const allIngredients = planning.ingredients
        ? [
            ...(planning.ingredients.main || []).map((ing, idx) => ({
              id: idx + 1,
              name: ing.name,
              quantity: `${ing.amount}${ing.unit}`.trim(),
              description: ing.notes || null,
              display_order: idx + 1
            })),
            ...(planning.ingredients.sub || []).map((ing, idx) => ({
              id: (planning.ingredients.main || []).length + idx + 1,
              name: ing.name,
              quantity: `${ing.amount}${ing.unit}`.trim(),
              description: ing.usage || null,
              display_order: (planning.ingredients.main || []).length + idx + 1
            }))
          ]
        : cleanedRecipe.ingredients || []; // Use cleaned recipe ingredients as fallback

      // steps 변환: AI 생성 레시피는 process 사용, 기존 레시피는 planned_steps 사용
      const steps = planning.process
        ? (planning.process || []).map((step) => ({
            id: step.step_index,
            step_number: step.step_index,
            description: step.description,
            image_url: null,
            duration: step.timer_seconds
          }))
        : (planning.planned_steps || []).map((step) => ({
            id: step.order,
            step_number: step.order,
            description: step.script,
            image_url: null,
            duration: step.estimated_time_sec
          }));

      // tips 추출 (process에서 tip이 있는 것들)
      const tips = planning.process
        ? (planning.process || [])
            .filter(step => step.tip && step.tip.trim())
            .map(step => step.tip!)
        : [];
      
      // 프론트엔드가 기대하는 형식으로 반환
      return res.json({
        id: cleanedRecipe.id,
        recipe_id: cleanedRecipe.recipe_id,
        title: planning.meta ? planning.meta.title : planning.title,
        servings: planning.meta ? `${planning.meta.servings}인분` : (servings || '알 수 없음'),
        cook_time: planning.meta ? `${planning.meta.time_estimate}분` : (cookTime || '알 수 없음'),
        difficulty: planning.meta ? planning.meta.difficulty : (difficulty || '보통'),
        source_url: sourceUrl || null,  // cleaned data의 url, 없으면 raw data에서 가져옴
        copyright: copyright,  // "Recipe by <작성자>" 형식
        tips: tips,
        ingredients: allIngredients,
        steps: steps
      });
    }
    
    // cleaned recipe가 없으면 기존 raw recipe 사용 (fallback)
    const recipe = await recipeService.getRecipeById(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// 레시피 검색 (raw recipes)
router.get('/search/query', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const recipes = await recipeService.searchRecipes(query);
    res.json({ recipes });
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

// 레시피 검색 (RAG - Phase 3)
router.get('/search/rag', async (req, res) => {
  try {
    const query = req.query.q as string;
    const top_k = parseInt(req.query.top_k as string) || 5;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    console.log(`[RAG Search] Searching with query: "${query}" (top_k=${top_k})`);

    // Call Python RAG search script via subprocess
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const fs = await import('fs');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const ragServerDir = path.join(__dirname, '../../../rag-server');
    const tempScriptPath = path.join(ragServerDir, 'temp_search.py');

    // Create temporary Python script to avoid shell injection
    const pythonScript = `
import sys
import json
from pathlib import Path

# Add rag-server to path
sys.path.insert(0, r'${ragServerDir.replace(/\\/g, '/')}')

from tools.search import search_with_details

try:
    query = r'${query.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}'
    top_k = ${top_k}
    results = search_with_details(query, top_k=top_k)
    print(json.dumps(results, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    fs.writeFileSync(tempScriptPath, pythonScript, 'utf-8');

    try {
      const pythonProcess = spawn('poetry', ['run', 'python3', tempScriptPath], {
        cwd: path.join(__dirname, '../../../'),  // Poetry project root
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      await new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
          } else {
            resolve();
          }
        });
      });

      const searchResults = JSON.parse(output.trim());

      if (searchResults.error) {
        throw new Error(searchResults.error);
      }

      // Get full recipe details from database
      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        return res.json({
          success: true,
          query,
          count: 0,
          hasResults: false,
          recipes: [],
          searchMethod: 'rag'
        });
      }

      const recipeIds = searchResults.map((r: any) => r.recipe_id);
      const placeholders = recipeIds.map((_: any, i: number) => `$${i + 1}`).join(', ');

      // Create array literal for ORDER BY (not parameterized)
      const arrayLiteral = recipeIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');

      const recipesResult = await pool.query(
        `SELECT cr.id, cr.recipe_id, cr.title, cr.opening_remark,
                r.difficulty, r.cook_time, r.servings,
                (SELECT COUNT(*) FROM cleaned_steps WHERE cleaned_recipe_id = cr.id) as total_steps
         FROM cleaned_recipes cr
         LEFT JOIN recipes r ON cr.recipe_id = r.recipe_id
         WHERE cr.recipe_id IN (${placeholders})
         ORDER BY array_position(ARRAY[${arrayLiteral}]::text[], cr.recipe_id)`,
        recipeIds
      );

      // Merge with search scores
      const scoreMap = new Map(searchResults.map((r: any) => [r.recipe_id, r.score]));
      const recipes = recipesResult.rows.map((row: any) => ({
        id: row.id,
        recipeId: row.recipe_id,
        title: row.title,
        openingRemark: row.opening_remark,
        difficulty: row.difficulty,
        cookTime: row.cook_time,
        servings: row.servings,
        totalSteps: row.total_steps,
        searchScore: scoreMap.get(row.recipe_id) || 0
      }));

      console.log(`[RAG Search] Found ${recipes.length} recipes`);

      res.json({
        success: true,
        query,
        count: recipes.length,
        hasResults: recipes.length > 0,
        recipes,
        searchMethod: 'rag'
      });
    } finally {
      // Ensure temp file is cleaned up
      try {
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error: any) {
    console.error('[RAG Search] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search recipes with RAG',
      message: error.message
    });
  }
});

// 난이도로 필터링
router.get('/filter/difficulty/:difficulty', async (req, res) => {
  try {
    const recipes = await recipeService.filterByDifficulty(req.params.difficulty);
    res.json({ recipes });
  } catch (error) {
    console.error('Error filtering recipes:', error);
    res.status(500).json({ error: 'Failed to filter recipes' });
  }
});

// 재료로 검색
router.get('/search/ingredient/:ingredient', async (req, res) => {
  try {
    const recipes = await recipeService.searchByIngredient(req.params.ingredient);
    res.json({ recipes });
  } catch (error) {
    console.error('Error searching by ingredient:', error);
    res.status(500).json({ error: 'Failed to search by ingredient' });
  }
});

// ============================================================================
// AI Recipe Generation
// ============================================================================

/**
 * POST /api/recipes/generate
 * Generate new recipe using AI
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[Recipe API] Generating recipe for: "${prompt}"`);

    // Step 1: Generate recipe using GPT-5-nano (returns PlanningOutput)
    const planningOutput = await recipeCreator.generateRecipe(prompt);

    // Step 2: Generate unique recipe_id
    const recipeId = `recipe_gen_${Date.now()}`;

    // Step 3: Save PlanningOutput directly to cleaned DB
    console.log(`[Recipe API] Saving recipe to cleaned DB: ${recipeId}`);
    const cleanedRecipe = await recipeCleaner.saveCleanedRecipe(recipeId, planningOutput);

    // Step 4: Optionally save to raw recipe database for reference
    const client = await pool.connect();
    try {
      // Save ingredients to raw DB for compatibility
      const allIngredients = [...planningOutput.ingredients.main, ...planningOutput.ingredients.sub];

      if (allIngredients.length > 0) {
        await client.query('BEGIN');

        // 기존 재료 삭제 (중복 방지)
        await client.query('DELETE FROM ingredients WHERE recipe_id = $1', [recipeId]);

        // 새 재료 삽입
        for (let i = 0; i < allIngredients.length; i++) {
          const ing = allIngredients[i];
          
          // 안전한 데이터 변환 및 null 체크
          if (!ing.name) {
            console.warn(`[Recipe API] Skipping ingredient with no name at index ${i}`);
            continue;
          }
          
          const quantity = ing.amount && ing.unit 
            ? `${ing.amount}${ing.unit}`.trim()
            : ing.amount || ing.unit || '';
          
          const description = ing.notes || ing.usage || null;
          const displayOrder = i + 1; // 정수값 보장
          
          await client.query(
            `INSERT INTO ingredients (recipe_id, name, quantity, description, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              recipeId,
              ing.name,
              quantity,
              description,
              displayOrder
            ]
          );
        }

        await client.query('COMMIT');
        console.log(`[Recipe API] Raw recipe ingredients saved: ${recipeId}`);
      } else {
        console.log(`[Recipe API] No ingredients to save for ${recipeId}`);
      }
    } catch (error: any) {
      // ROLLBACK 시도 (실패해도 무시)
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // 이미 롤백되었거나 트랜잭션이 없는 경우 무시
      }
      console.error('[Recipe API] Failed to save raw recipe ingredients (non-critical):', error);
      // Don't throw - cleaned recipe is already saved
    } finally {
      client.release();
    }

    // Step 5: Return result (ready for immediate use in session)
    res.json({
      success: true,
      recipe_id: recipeId,
      title: planningOutput.meta.title,
      cleaned_recipe_id: cleanedRecipe.id,
      planning_result: planningOutput, // Return PlanningOutput for immediate use
      message: 'Recipe generated and saved successfully'
    });

    console.log(`[Recipe API] Recipe generation completed: ${recipeId}`);
  } catch (error: any) {
    console.error('[Recipe API] Recipe generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate recipe',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * POST /api/recipes/recommend
 * Get recipe recommendations based on preferences
 */
router.post('/recommend', async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'string') {
      return res.status(400).json({ error: 'Preferences are required' });
    }

    console.log(`[Recipe API] Getting recommendations for: "${preferences}"`);

    const recommendations = await recipeCreator.recommendRecipes(preferences);

    res.json({
      success: true,
      recommendations
    });

    console.log(`[Recipe API] Returned ${recommendations.length} recommendations`);
  } catch (error: any) {
    console.error('[Recipe API] Recipe recommendation failed:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * DELETE /api/recipes/:recipeId
 * Delete a recipe (AI-generated only)
 */
router.delete('/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;

    console.log(`[Recipe API] Delete request for: ${recipeId}`);

    // Safety check: Only allow deletion of AI-generated recipes
    if (!recipeId.startsWith('recipe_gen_')) {
      return res.status(403).json({
        error: 'Cannot delete original recipes',
        message: 'Only AI-generated recipes can be deleted'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete from cleaned_steps
      await client.query(
        `DELETE FROM cleaned_steps
         WHERE cleaned_recipe_id IN (
           SELECT id FROM cleaned_recipes WHERE recipe_id = $1
         )`,
        [recipeId]
      );

      // Delete from cleaned_recipes
      await client.query(
        'DELETE FROM cleaned_recipes WHERE recipe_id = $1',
        [recipeId]
      );

      // Delete from ingredients
      await client.query(
        'DELETE FROM ingredients WHERE recipe_id = $1',
        [recipeId]
      );

      // Delete from steps
      await client.query(
        'DELETE FROM steps WHERE recipe_id = $1',
        [recipeId]
      );

      // Delete from recipes
      const result = await client.query(
        'DELETE FROM recipes WHERE recipe_id = $1 RETURNING recipe_id',
        [recipeId]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Recipe not found'
        });
      }

      await client.query('COMMIT');
      console.log(`[Recipe API] Successfully deleted recipe: ${recipeId}`);

      res.json({
        success: true,
        message: 'Recipe deleted successfully',
        recipe_id: recipeId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Recipe API] Recipe deletion failed:', error);
    res.status(500).json({
      error: 'Failed to delete recipe',
      message: error.message || 'Unknown error'
    });
  }
});

export default router;