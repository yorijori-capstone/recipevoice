/**
 * Import Raw Recipes Script
 * 
 * Reads raw recipe JSON files from storage/raw_data and imports them into PostgreSQL.
 * Optionally performs cleaning/planning after import.
 * 
 * Usage:
 *   npm run import                           # Import all recipes with cleaning
 *   npm run import -- --delete-existing      # Delete existing data first
 *   npm run import -- --skip-cleaning        # Skip cleaning step
 *   npm run import -- --test                 # Test mode (process first 5 files only)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../src/db/pool.js';
import { RecipeCleaner } from '../src/services/recipeCleaner.js';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================================================
// Configuration
// ============================================================================

const RAW_DATA_DIR = path.join(__dirname, '../../storage/raw_data');
const DELETE_EXISTING = process.argv.includes('--delete-existing');
const SKIP_CLEANING = process.argv.includes('--skip-cleaning');
const TEST_MODE = process.argv.includes('--test');

// ============================================================================
// Types
// ============================================================================

interface RecipeJSON {
  recipe_id?: string;
  id?: string;
  title?: string;
  servings?: string | number;
  cook_time?: string | number;
  difficulty?: string;
  tips?: string[] | string;
  source_url?: string;
  copyright?: string;
  author?: string;
  ingredients?: Array<{
    name?: string;
    quantity?: string;
    description?: string;
    amount?: string;
    unit?: string;
  }>;
  ingredients_struct?: Array<{
    name?: string;
    quantity?: string;
    description?: string;
    amount?: string;
    unit?: string;
  }>;
  steps?: Array<{
    step_number?: number;
    description?: string;
    order?: number;
    instruction?: string;
  }>;
  instructions?: Array<{
    step_number?: number;
    description?: string;
    order?: number;
    instruction?: string;
  }>;
  process?: Array<{
    step_number?: number;
    description?: string;
    order?: number;
    instruction?: string;
  }>;
  [key: string]: any; // Allow additional fields
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseJSONFile(filePath: string): RecipeJSON | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    console.error(`  ❌ JSON 파싱 실패: ${error.message}`);
    return null;
  }
}

function parseNDJSONFile(filePath: string): RecipeJSON[] {
  const recipes: RecipeJSON[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        recipes.push(JSON.parse(line));
      } catch (error: any) {
        console.error(`  ❌ NDJSON 라인 파싱 실패: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error(`  ❌ NDJSON 파일 읽기 실패: ${error.message}`);
  }
  return recipes;
}

function getRecipeId(recipe: RecipeJSON): string | null {
  return recipe.recipe_id || recipe.id || null;
}

function normalizeNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// ============================================================================
// Database Operations
// ============================================================================

async function grantPermissions(): Promise<void> {
  console.log('🔐 권한 부여 중...');
  const client = await pool.connect();
  try {
    // Grant permissions on all tables
    await client.query('GRANT ALL PRIVILEGES ON TABLE recipes TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE ingredients TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE steps TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE cleaned_recipes TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE cleaned_steps TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE cooking_sessions TO recipevoice');
    await client.query('GRANT ALL PRIVILEGES ON TABLE session_states TO recipevoice');
    
    // Grant permissions on sequences
    await client.query('GRANT USAGE, SELECT ON SEQUENCE recipes_id_seq TO recipevoice');
    await client.query('GRANT USAGE, SELECT ON SEQUENCE ingredients_id_seq TO recipevoice');
    await client.query('GRANT USAGE, SELECT ON SEQUENCE steps_id_seq TO recipevoice');
    await client.query('GRANT USAGE, SELECT ON SEQUENCE cleaned_recipes_id_seq TO recipevoice');
    await client.query('GRANT USAGE, SELECT ON SEQUENCE cleaned_steps_id_seq TO recipevoice');
    await client.query('GRANT USAGE, SELECT ON SEQUENCE session_states_id_seq TO recipevoice');
  
    console.log('✅ 권한 부여 완료\n');
  } catch (error: any) {
    // 권한 부여 실패는 무시 (이미 권한이 있거나 superuser가 아닐 수 있음)
    console.warn('⚠️  권한 부여 실패 (무시됨):', error.message);
  } finally {
    client.release();
  }
}

async function deleteExistingData(): Promise<void> {
  console.log('🗑️  기존 데이터 삭제 중...');
  const client = await pool.connect();
  let clientReleased = false;
  
  try {
    await client.query('BEGIN');
    
    // Delete in order (respecting foreign keys)
    try {
      await client.query('TRUNCATE TABLE cleaned_steps CASCADE');
      await client.query('TRUNCATE TABLE cleaned_recipes CASCADE');
      await client.query('TRUNCATE TABLE steps CASCADE');
      await client.query('TRUNCATE TABLE ingredients CASCADE');
      await client.query('TRUNCATE TABLE recipes CASCADE');
      
      // cooking_sessions와 session_states는 선택적으로 삭제 (없을 수 있음)
      try {
        await client.query('TRUNCATE TABLE session_states CASCADE');
        await client.query('TRUNCATE TABLE cooking_sessions CASCADE');
      } catch (e: any) {
        // 테이블이 없거나 권한이 없으면 무시
        if (e.code !== '42P01' && e.code !== '42501') {
          throw e;
        }
        if (e.code === '42501') {
          console.log('⚠️  session 테이블 권한 없음 (무시됨)');
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ 기존 데이터 삭제 완료\n');
      clientReleased = true;
      client.release();
      return;
    } catch (error: any) {
      // 권한 오류 발생 시 권한 부여 시도
      if (error.code === '42501') {
        console.log('⚠️  권한 오류 발생, 권한 부여 시도 중...');
        try {
          await client.query('ROLLBACK');
        } catch (e) {
          // Ignore rollback errors
        }
        client.release();
        clientReleased = true;
        
        await grantPermissions();
        
        // 권한 부여 후 다시 시도
        const retryClient = await pool.connect();
        try {
          await retryClient.query('BEGIN');
          await retryClient.query('TRUNCATE TABLE cleaned_steps CASCADE');
          await retryClient.query('TRUNCATE TABLE cleaned_recipes CASCADE');
          await retryClient.query('TRUNCATE TABLE steps CASCADE');
          await retryClient.query('TRUNCATE TABLE ingredients CASCADE');
          await retryClient.query('TRUNCATE TABLE recipes CASCADE');
          
          // session 테이블은 선택적으로
          try {
            await retryClient.query('TRUNCATE TABLE session_states CASCADE');
            await retryClient.query('TRUNCATE TABLE cooking_sessions CASCADE');
          } catch (e: any) {
            if (e.code !== '42P01' && e.code !== '42501') {
              throw e;
            }
          }
          
          await retryClient.query('COMMIT');
          console.log('✅ 기존 데이터 삭제 완료\n');
        return;
        } catch (retryError: any) {
          await retryClient.query('ROLLBACK');
          throw retryError;
        } finally {
          retryClient.release();
        }
      }
      throw error;
    }
  } catch (error: any) {
    if (!clientReleased) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {
        // Ignore rollback errors
      }
    }
    console.error('❌ 데이터 삭제 실패:', error.message);
    if (error.code === '42501') {
      console.error('\n💡 해결 방법: 다음 명령으로 권한을 부여하세요:');
      console.error('   psql -U postgres -d recipevoice -f backend/migrations/005_grant_permissions.sql');
      console.error('   또는 pgAdmin에서 backend/migrations/005_grant_permissions.sql 파일을 실행하세요.\n');
    }
    throw error;
  } finally {
    if (!clientReleased) {
      client.release();
    }
  }
}

async function ensureCleanTransaction(client: any): Promise<void> {
  // Ensure we have a clean transaction for each file
  try {
    await client.query('ROLLBACK');
  } catch (e) {
    // Ignore if no transaction
  }
    await client.query('BEGIN');
}

async function importRecipe(
  recipe: RecipeJSON,
  client: any,
  recipeCleaner: RecipeCleaner
): Promise<{ success: boolean; recipeId: string | null; error?: string }> {
  const recipeId = getRecipeId(recipe);
  if (!recipeId) {
    return { success: false, recipeId: null, error: 'recipe_id 또는 id가 없습니다' };
  }

  try {
    // Ensure clean transaction
    await ensureCleanTransaction(client);

    // Insert recipe with raw_data (원문 그대로 저장)
    const title = recipe.title || '제목 없음';
    const servings = recipe.servings?.toString() || null;
    const cookTime = recipe.cook_time?.toString() || null;
    const difficulty = recipe.difficulty || null;
    const tips = Array.isArray(recipe.tips) 
      ? recipe.tips 
      : (recipe.tips ? [recipe.tips] : []);
    const sourceUrl = recipe.source_url || null;
    const copyright = recipe.copyright || recipe.author || null;
    
    // Raw data를 원문 그대로 JSONB로 저장
    const rawData = JSON.stringify(recipe);

    await client.query(
      `INSERT INTO recipes (recipe_id, title, servings, cook_time, difficulty, tips, source_url, copyright, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (recipe_id) DO UPDATE SET
         title = EXCLUDED.title,
         servings = EXCLUDED.servings,
         cook_time = EXCLUDED.cook_time,
         difficulty = EXCLUDED.difficulty,
         tips = EXCLUDED.tips,
         source_url = EXCLUDED.source_url,
         copyright = EXCLUDED.copyright,
         raw_data = EXCLUDED.raw_data,
         updated_at = CURRENT_TIMESTAMP`,
      [recipeId, title, servings, cookTime, difficulty, tips, sourceUrl, copyright, rawData]
        );

    // Note: ingredients와 steps 테이블은 더 이상 사용하지 않음
    // GPT-5-nano가 raw_data를 직접 파싱하여 처리

    // Commit raw recipe import
    await client.query('COMMIT');
    console.log(`  ✅ Raw recipe imported: ${recipeId}`);

    // Step 2: Clean and plan recipe (if not skipped)
    if (!SKIP_CLEANING) {
      try {
        await recipeCleaner.cleanAndPlanRecipe(recipeId);
        console.log(`  ✅ Recipe cleaned: ${recipeId}`);
      } catch (cleanError: any) {
        console.error(`  ⚠️  Cleaning failed for ${recipeId}:`, cleanError.message);
        // Don't throw - raw recipe is already saved
      }
    }

    return { success: true, recipeId };
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    return { success: false, recipeId, error: error.message };
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('🚀 Recipe Import Script - Starting...\n');

  // Check environment
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !SKIP_CLEANING) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Initialize services
  const recipeCleaner = apiKey 
    ? new RecipeCleaner(apiKey)
    : null;

  // Check raw data directory
  if (!fs.existsSync(RAW_DATA_DIR)) {
    console.error(`❌ Raw data directory not found: ${RAW_DATA_DIR}`);
    process.exit(1);
  }

  // Delete existing data if requested
  if (DELETE_EXISTING) {
    await deleteExistingData();
  }

  // Get all JSON files
  const files = fs.readdirSync(RAW_DATA_DIR)
    .filter(file => file.endsWith('.json') || file.endsWith('.ndjson'))
    .map(file => path.join(RAW_DATA_DIR, file));

  if (files.length === 0) {
    console.error(`❌ No JSON files found in ${RAW_DATA_DIR}`);
    process.exit(1);
  }

  console.log(`📂 Found ${files.length} file(s) to process`);
  if (TEST_MODE) {
    console.log('🧪 Test mode: Processing first 5 files only\n');
          }
  console.log('');

  // Process files
  const client = await pool.connect();
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ file: string; recipeId: string | null; error: string }>
  };

  try {
    const filesToProcess = TEST_MODE ? files.slice(0, 5) : files;

    for (let i = 0; i < filesToProcess.length; i++) {
      const filePath = filesToProcess[i];
      const fileName = path.basename(filePath);
      console.log(`[${i + 1}/${filesToProcess.length}] Processing: ${fileName}`);

      let recipes: RecipeJSON[] = [];

      if (fileName.endsWith('.ndjson')) {
        recipes = parseNDJSONFile(filePath);
      } else {
        const recipe = parseJSONFile(filePath);
        if (recipe) {
          recipes = [recipe];
          }
        }

      if (recipes.length === 0) {
        console.log(`  ⚠️  No valid recipes found in file\n`);
        results.skipped++;
        continue;
        }

      // Process each recipe in the file
      for (const recipe of recipes) {
        results.total++;
        const recipeId = getRecipeId(recipe);

        if (!recipeId) {
          console.log(`  ⚠️  Skipping recipe without ID`);
          results.skipped++;
          continue;
        }

        const result = await importRecipe(recipe, client, recipeCleaner!);
        
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            file: fileName,
            recipeId: result.recipeId,
            error: result.error || 'Unknown error'
          });
          console.log(`  ❌ Failed: ${result.error}`);
        }
      }

      console.log('');
    }
  } finally {
    client.release();
  }

  // Print results
  console.log('═'.repeat(60));
  console.log('📊 Import Results');
  console.log('═'.repeat(60));
  console.log(`Total Recipes:     ${results.total}`);
  console.log(`✅ Successful:     ${results.success}`);
  console.log(`⏭️  Skipped:        ${results.skipped}`);
  console.log(`❌ Failed:         ${results.failed}`);
  console.log('═'.repeat(60));

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Recipes:');
    console.log('─'.repeat(60));
    results.errors.forEach(({ file, recipeId, error }) => {
      console.log(`  • ${file} (${recipeId || 'N/A'}): ${error}`);
    });
    console.log('─'.repeat(60));
  }

  console.log('\n🎉 Import completed!');
    await pool.end();
  }

// ============================================================================
// Run Script
// ============================================================================

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

