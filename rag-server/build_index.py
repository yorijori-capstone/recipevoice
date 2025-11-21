"""Build FAISS index from PostgreSQL recipe data."""

import json
import psycopg
import faiss
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
from psycopg.rows import dict_row

from data.app.config_loader import load_config
from data.app.emb_local import LocalEmbedder

ROOT_DIR = Path(__file__).resolve().parent
CFG = load_config(ROOT_DIR / "config.yaml")

DB_CFG = CFG["database"]
INDEX_PATH = ROOT_DIR / CFG["paths"]["faiss_index_path"]
MODEL_NAME = CFG["embedding"]["model"]


def get_db_connection():
    """Get PostgreSQL connection."""
    return psycopg.connect(
        dbname=DB_CFG["name"],
        user=DB_CFG["user"],
        password=DB_CFG["password"],
        host=DB_CFG["host"],
        port=DB_CFG["port"],
        row_factory=dict_row
    )


def fetch_recipes() -> List[Dict[str, Any]]:
    """Fetch all recipes with ingredients and steps."""
    print("📂 Fetching recipes from PostgreSQL...")
    
    with get_db_connection() as conn, conn.cursor() as cur:
        # Get all recipes
        cur.execute("SELECT * FROM recipes ORDER BY recipe_id")
        recipes = [dict(row) for row in cur.fetchall()]
        
        print(f"✅ Found {len(recipes)} recipes")
        
        # Get ingredients and steps for each recipe
        for recipe in recipes:
            recipe_id = recipe['recipe_id']
            
            # Ingredients
            cur.execute(
                "SELECT name, quantity FROM ingredients WHERE recipe_id = %s ORDER BY display_order",
                (recipe_id,)
            )
            recipe['ingredients'] = [dict(row) for row in cur.fetchall()]
            
            # Steps
            cur.execute(
                "SELECT description FROM steps WHERE recipe_id = %s ORDER BY step_number",
                (recipe_id,)
            )
            recipe['steps'] = [dict(row) for row in cur.fetchall()]
        
        return recipes


def create_recipe_text(recipe: Dict[str, Any]) -> str:
    """
    Create searchable text from recipe.
    
    Format:
    제목: [title]
    재료: [ingredient1], [ingredient2], ...
    조리법: [step1] [step2] ...
    난이도: [difficulty]
    조리시간: [cook_time]
    """
    title = recipe.get('title', '')
    
    # Ingredients
    ingredients = recipe.get('ingredients', [])
    ingredient_text = ', '.join([f"{ing['name']} {ing['quantity']}" for ing in ingredients])
    
    # Steps
    steps = recipe.get('steps', [])
    steps_text = ' '.join([step['description'] for step in steps])
    
    # Metadata
    difficulty = recipe.get('difficulty', '')
    cook_time = recipe.get('cook_time', '')
    servings = recipe.get('servings', '')
    
    # Combine
    text = f"""제목: {title}
재료: {ingredient_text}
조리법: {steps_text}
난이도: {difficulty}
조리시간: {cook_time}
인분: {servings}"""
    
    return text


def build_faiss_index():
    """Build FAISS index from recipes."""
    
    print("\n" + "="*60)
    print("🚀 FAISS 인덱스 구축 시작")
    print("="*60 + "\n")
    
    # 1. Load embedding model
    print(f"📥 임베딩 모델 로딩: {MODEL_NAME}")
    print("   (처음 실행 시 모델 다운로드로 시간이 걸릴 수 있습니다...)\n")
    embedder = LocalEmbedder(MODEL_NAME)
    
    # 2. Fetch recipes
    recipes = fetch_recipes()
    
    if not recipes:
        print("❌ 레시피가 없습니다!")
        return
    
    # 3. Create searchable texts
    print("\n📝 검색 가능한 텍스트 생성 중...")
    texts = []
    metadata = []
    
    for i, recipe in enumerate(recipes, 1):
        text = create_recipe_text(recipe)
        texts.append(text)
        
        metadata.append({
            'recipe_id': recipe['recipe_id'],
            'title': recipe['title'],
            'text_preview': text[:200] + '...'
        })
        
        if i % 20 == 0:
            print(f"   진행: {i}/{len(recipes)}")
    
    print(f"✅ {len(texts)}개의 텍스트 생성 완료\n")
    
    # 4. Generate embeddings
    print("🧠 임베딩 생성 중 (시간이 걸립니다...)...")
    embeddings = embedder.encode(texts)
    print(f"✅ {len(embeddings)}개의 임베딩 생성 완료")
    print(f"   벡터 차원: {embeddings.shape[1]}\n")
    
    # 5. Build FAISS index
    print("🔨 FAISS 인덱스 구축 중...")
    dimension = embeddings.shape[1]
    
    # Use IndexFlatL2 for exact search
    index = faiss.IndexFlatL2(dimension)
    
    # Normalize for cosine similarity
    faiss.normalize_L2(embeddings)
    
    index.add(embeddings)
    print(f"✅ FAISS 인덱스 구축 완료 ({index.ntotal}개 벡터)\n")
    
    # 6. Save index
    print("💾 인덱스 저장 중...")
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(INDEX_PATH))
    print(f"✅ 인덱스 저장: {INDEX_PATH}")
    
    # 7. Save metadata
    metadata_path = INDEX_PATH.parent / "metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"✅ 메타데이터 저장: {metadata_path}\n")
    
    print("="*60)
    print("🎉 FAISS 인덱스 구축 완료!")
    print("="*60)
    print(f"\n📊 요약:")
    print(f"   - 총 벡터 수: {index.ntotal}")
    print(f"   - 벡터 차원: {dimension}")
    print(f"   - 인덱스 파일: {INDEX_PATH}")
    print(f"   - 메타데이터: {metadata_path}\n")


if __name__ == "__main__":
    try:
        build_faiss_index()
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()