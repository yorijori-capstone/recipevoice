-- 데이터베이스 생성 (psql에서 직접 실행)
-- CREATE DATABASE recipe_db;

-- 데이터베이스 연결 후 실행
-- \c recipe_db;

-- 기존 테이블 삭제 (재실행 시)
DROP TABLE IF EXISTS steps CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;

-- 레시피 테이블
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    recipe_id VARCHAR(50) UNIQUE NOT NULL,
    source_url TEXT,
    title VARCHAR(255) NOT NULL,
    servings VARCHAR(50),
    cook_time VARCHAR(50),
    difficulty VARCHAR(50),
    tips TEXT[],
    copyright VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 재료 테이블
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id VARCHAR(50) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    quantity VARCHAR(50),
    display_order INTEGER
);

-- 조리 단계 테이블
CREATE TABLE steps (
    id SERIAL PRIMARY KEY,
    recipe_id VARCHAR(50) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    duration INTEGER
);

-- 인덱스 생성
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX idx_recipes_cook_time ON recipes(cook_time);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_ingredients_recipe_id ON ingredients(recipe_id);
CREATE INDEX idx_steps_recipe_id ON steps(recipe_id);

-- 완료 메시지
SELECT 'Database schema created successfully!' as status;