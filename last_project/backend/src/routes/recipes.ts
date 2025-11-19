import express from 'express';
import { RecipeService } from '../services/recipeService.js';

const router = express.Router();
const recipeService = new RecipeService();

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

// 레시피 검색
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

export default router;