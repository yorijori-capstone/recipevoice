import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testConnection() {
  console.log('=== 연결 테스트 시작 ===');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'recipe_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
  
  console.log('연결 설정:', config);
  
  const pool = new Pool(config);
  
  try {
    const client = await pool.connect();
    console.log('✅ 연결 성공!');
    
    const result = await client.query('SELECT current_database(), version()');
    console.log('현재 DB:', result.rows[0].current_database);
    console.log('버전:', result.rows[0].version);
    
    client.release();
  } catch (error) {
    console.error('❌ 연결 실패:', error);
  } finally {
    await pool.end();
  }
}

testConnection();