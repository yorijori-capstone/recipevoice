// backend/scripts/import-recipes.ts 전체 교체

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('=== 환경 변수 확인 ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✓ 설정됨' : '✗ 없음');
console.log('====================\n');

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'recipe_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  client_encoding: 'UTF8', // 인코딩 명시
});

interface RecipeJSON {
  recipe_id: string;
  source_url: string;
  title: string;
  ingredients: string[];
  ingredients_struct: Array<{
    name: string;
    desc: string | null;
    qty: string;
  }>;
  steps: string[];
  tips: string[];
  copyright: string;
  servings: string;
  cook_time: string;
  difficulty: string;
}

async function importRecipes() {
  const rawDataDir = path.join(__dirname, '../../storage/raw_data');
  
  console.log('📂 Looking for raw_data at:', rawDataDir);

  if (!fs.existsSync(rawDataDir)) {
    console.error('❌ raw_data 폴더를 찾을 수 없습니다:', rawDataDir);
    return;
  }

  const files = fs.readdirSync(rawDataDir).filter(f => f.endsWith('.json'));
  
  console.log(`📂 총 ${files.length}개의 레시피 파일을 찾았습니다.\n`);

  // 연결 재시도
  let client: pg.PoolClient | undefined;  // 타입 명시
  let retries = 5;

  
  while (retries > 0) {
    try {
      console.log('🔌 PostgreSQL 연결 시도 중...');
      client = await pool.connect();
      console.log('✅ PostgreSQL 연결 성공!\n');
      break;
    } catch (error: any) {
      retries--;
      console.log(`⏳ 연결 재시도 중... (${5 - retries}/5)`);
      console.log('   오류:', error.message);
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
      } else {
        console.error('\n❌ PostgreSQL 연결 실패:', error);
        await pool.end();
        return;
      }
    }
  }
  
  try {
    await client.query('BEGIN');
    
    let imported = 0;
    let skipped = 0;

    for (const file of files) {
      try {
        const filePath = path.join(rawDataDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RecipeJSON;

        const recipeResult = await client.query(
          `INSERT INTO recipes (recipe_id, source_url, title, servings, cook_time, difficulty, tips, copyright)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (recipe_id) DO NOTHING
           RETURNING id`,
          [
            data.recipe_id,
            data.source_url,
            data.title,
            data.servings,
            data.cook_time,
            data.difficulty,
            data.tips,
            data.copyright
          ]
        );

        if (recipeResult.rowCount === 0) {
          skipped++;
          continue;
        }

        if (data.ingredients_struct && data.ingredients_struct.length > 0) {
          for (let i = 0; i < data.ingredients_struct.length; i++) {
            const ing = data.ingredients_struct[i];
            await client.query(
              `INSERT INTO ingredients (recipe_id, name, description, quantity, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [data.recipe_id, ing.name, ing.desc, ing.qty, i + 1]
            );
          }
        }

        if (data.steps && data.steps.length > 0) {
          for (let i = 0; i < data.steps.length; i++) {
            await client.query(
              `INSERT INTO steps (recipe_id, step_number, description)
               VALUES ($1, $2, $3)`,
              [data.recipe_id, i + 1, data.steps[i]]
            );
          }
        }

        imported++;
        if (imported % 10 === 0) {
          console.log(`✅ [${imported}/${files.length}] 진행 중...`);
        }

      } catch (error) {
        skipped++;
        console.error(`❌ 파일 처리 실패: ${file}`, error);
      }
    }

    await client.query('COMMIT');
    console.log(`\n🎉 완료! 성공: ${imported}개, 건너뜀: ${skipped}개`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 트랜잭션 오류:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importRecipes();