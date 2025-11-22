import express from 'express';
import { RecipeService } from '../services/recipeService.js';
import { NanoService } from '../services/nanoService.js';
import { CleanedRecipeService } from '../services/cleanedRecipeService.js';
import { pool } from '../db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const recipeService = new RecipeService();
const nanoService = new NanoService(process.env.OPENAI_API_KEY || '');
const cleanedRecipeService = new CleanedRecipeService(process.env.OPENAI_API_KEY || '');

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

// 레시피 상세
router.get('/:recipeId', async (req, res) => {
  try {
    const recipe = await recipeService.getRecipeById(req.params.recipeId);
    
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

// 레시피 검색 (cleaned recipes - V2)
router.get('/search/cleaned', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    console.log(`[Recipe Search] Searching cleaned recipes for: "${query}"`);

    // Search in cleaned_recipes table
    const result = await pool.query(
      `SELECT cr.id, cr.recipe_id, cr.title, cr.opening_remark,
              r.difficulty, r.cook_time, r.servings,
              (SELECT COUNT(*) FROM cleaned_steps WHERE cleaned_recipe_id = cr.id) as total_steps
       FROM cleaned_recipes cr
       LEFT JOIN recipes r ON cr.recipe_id = r.recipe_id
       WHERE cr.title ILIKE $1
       ORDER BY cr.created_at DESC
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

    // Step 1: Generate recipe using GPT-3.5-turbo
    const generatedRecipe = await nanoService.generateRecipe(prompt);

    // Step 2: Generate unique recipe_id
    const recipeId = `recipe_gen_${Date.now()}`;

    // Step 3: Save to raw recipe database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert recipe
      await client.query(
        `INSERT INTO recipes (recipe_id, title, servings, cook_time, difficulty, tips, source_url, copyright)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          recipeId,
          generatedRecipe.title,
          generatedRecipe.servings,
          generatedRecipe.cook_time,
          generatedRecipe.difficulty,
          generatedRecipe.tips || [],
          'AI Generated',
          'Generated by GPT-3.5-turbo'
        ]
      );

      // Insert ingredients
      for (let i = 0; i < generatedRecipe.ingredients.length; i++) {
        const ing = generatedRecipe.ingredients[i];
        await client.query(
          `INSERT INTO ingredients (recipe_id, name, quantity, description, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [recipeId, ing.name, ing.quantity, ing.description || null, i + 1]
        );
      }

      // Insert steps
      for (const step of generatedRecipe.steps) {
        await client.query(
          `INSERT INTO steps (recipe_id, step_number, description)
           VALUES ($1, $2, $3)`,
          [recipeId, step.order, step.description]
        );
      }

      await client.query('COMMIT');
      console.log(`[Recipe API] Raw recipe saved: ${recipeId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Step 4: Automatically clean and plan the recipe
    console.log(`[Recipe API] Auto-planning recipe: ${recipeId}`);
    const cleanedRecipe = await cleanedRecipeService.cleanAndPlanRecipe(recipeId);

    // Step 5: Return result
    res.json({
      success: true,
      recipe_id: recipeId,
      title: generatedRecipe.title,
      cleaned_recipe_id: cleanedRecipe.id,
      message: 'Recipe generated and planned successfully'
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

    const recommendations = await nanoService.recommendRecipes(preferences);

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