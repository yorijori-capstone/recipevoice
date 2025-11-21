/**
 * Batch Clean Recipes Script
 * Pre-process all raw recipes with Planning Service
 */

import dotenv from 'dotenv';
import { pool } from '../src/db/pool.js';
import { CleanedRecipeService } from '../src/services/cleanedRecipeService.js';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const CONCURRENT_LIMIT = 1; // Process recipes sequentially to avoid rate limits
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllRecipeIds(): Promise<string[]> {
  const result = await pool.query('SELECT recipe_id FROM recipes ORDER BY created_at ASC');
  return result.rows.map((row) => row.recipe_id);
}

async function cleanRecipeWithRetry(
  service: CleanedRecipeService,
  recipeId: string,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    await service.cleanAndPlanRecipe(recipeId);
    return { success: true };
  } catch (error: any) {
    console.error(`  ❌ Attempt ${attempt} failed:`, error.message);

    if (attempt < RETRY_ATTEMPTS) {
      console.log(`  🔄 Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return cleanRecipeWithRetry(service, recipeId, attempt + 1);
    }

    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('🚀 Batch Clean Recipes - Starting...\n');

  const startTime = Date.now();

  // Initialize service
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  const cleanedRecipeService = new CleanedRecipeService(apiKey);

  try {
    // Get all recipe IDs
    console.log('📋 Fetching recipe list...');
    const recipeIds = await getAllRecipeIds();
    const totalRecipes = recipeIds.length;

    console.log(`✅ Found ${totalRecipes} recipes\n`);

    if (totalRecipes === 0) {
      console.log('⚠️  No recipes found in database');
      return;
    }

    // Track results
    const results = {
      total: totalRecipes,
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ recipeId: string; error: string }>
    };

    // Process each recipe
    for (let i = 0; i < recipeIds.length; i++) {
      const recipeId = recipeIds[i];
      const progress = `[${i + 1}/${totalRecipes}]`;

      console.log(`${progress} Processing: ${recipeId}`);

      // Check if already cleaned
      const alreadyCleaned = await cleanedRecipeService.isRecipeCleaned(recipeId);

      if (alreadyCleaned) {
        console.log(`  ⏭️  Already cleaned - skipping\n`);
        results.skipped++;
        continue;
      }

      // Clean recipe with retry
      const cleanStart = Date.now();
      const result = await cleanRecipeWithRetry(cleanedRecipeService, recipeId);
      const cleanDuration = ((Date.now() - cleanStart) / 1000).toFixed(2);

      if (result.success) {
        console.log(`  ✅ Success (${cleanDuration}s)\n`);
        results.success++;
      } else {
        console.log(`  ❌ Failed after ${RETRY_ATTEMPTS} attempts\n`);
        results.failed++;
        results.errors.push({
          recipeId,
          error: result.error || 'Unknown error'
        });
      }

      // Rate limiting delay (avoid OpenAI API limits)
      if (i < recipeIds.length - 1) {
        await sleep(1000); // 1 second delay between recipes
      }
    }

    // Print final results
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('═'.repeat(60));
    console.log('📊 Batch Cleaning Results');
    console.log('═'.repeat(60));
    console.log(`Total Recipes:     ${results.total}`);
    console.log(`✅ Successful:     ${results.success}`);
    console.log(`⏭️  Skipped:        ${results.skipped} (already cleaned)`);
    console.log(`❌ Failed:         ${results.failed}`);
    console.log(`⏱️  Total Time:     ${totalDuration}s`);
    console.log('═'.repeat(60));

    // Print errors if any
    if (results.errors.length > 0) {
      console.log('\n❌ Failed Recipes:');
      console.log('─'.repeat(60));
      results.errors.forEach(({ recipeId, error }) => {
        console.log(`  • ${recipeId}`);
        console.log(`    Error: ${error}`);
      });
      console.log('─'.repeat(60));
    }

    console.log('\n🎉 Batch cleaning completed!');
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// ============================================================================
// Run Script
// ============================================================================

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
