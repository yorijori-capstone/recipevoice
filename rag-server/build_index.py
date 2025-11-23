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
    """Fetch cleaned recipes with planning_result from cleaned_recipes table."""
    print("📂 Fetching cleaned recipes from PostgreSQL...")
    
    with get_db_connection() as conn, conn.cursor() as cur:
        # Get all cleaned recipes with planning_result
        cur.execute("""
            SELECT 
                cr.recipe_id,
                cr.title,
                cr.planning_result
            FROM cleaned_recipes cr
            ORDER BY cr.recipe_id
        """)
        
        recipes = []
        for row in cur.fetchall():
            recipe = dict(row)
            recipe_id = recipe['recipe_id']
            
            # Parse planning_result JSONB
            planning_result = recipe.get('planning_result', {})
            if isinstance(planning_result, str):
                planning_result = json.loads(planning_result)
            
            # Extract data from planning_result
            recipe['planning_result'] = planning_result
            recipe['meta'] = planning_result.get('meta', {})
            recipe['ingredients'] = planning_result.get('ingredients', {})
            recipe['tools'] = planning_result.get('tools', [])
            recipe['process'] = planning_result.get('process', [])
            
            recipes.append(recipe)
        
        print(f"✅ Found {len(recipes)} cleaned recipes")
        return recipes


def create_summary_chunk(recipe: Dict[str, Any]) -> str:
    """
    Type A: Summary Chunk
    목적: 탐색형 질문 대응 ("저녁 메뉴 추천해줘", "간단한 반찬 뭐 있어?")
    Uses cleaned data from planning_result.meta
    """
    meta = recipe.get('meta', {})
    title = meta.get('title', '') or recipe.get('title', '')
    description = meta.get('description', '') or f"{title} 레시피입니다."
    servings = meta.get('servings', '')
    time_estimate = meta.get('time_estimate', '')
    difficulty = meta.get('difficulty', '')
    
    text = f"""[요리명: {title}]
설명: {description}
특징: {servings}인분, 조리시간 {time_estimate}분, 난이도 {difficulty}."""
    
    return text


def create_ingredient_chunk(recipe: Dict[str, Any]) -> str:
    """
    Type B: Ingredient Chunk
    목적: 재료 기반 검색 대응 ("연근으로 할 수 있는 요리 있어?", "냉장고 파먹기")
    Uses cleaned data from planning_result.ingredients.main/sub
    """
    meta = recipe.get('meta', {})
    title = meta.get('title', '') or recipe.get('title', '')
    ingredients_data = recipe.get('ingredients', {})
    
    # Get main and sub ingredients from cleaned data
    main_ingredients_list = ingredients_data.get('main', [])
    sub_ingredients_list = ingredients_data.get('sub', [])
    
    # Format main ingredients
    main_ingredients = []
    for ing in main_ingredients_list:
        name = ing.get('name', '').strip()
        amount = ing.get('amount', '')
        unit = ing.get('unit', '').strip()
        if name:
            if amount and unit:
                main_ingredients.append(f"{name} {amount}{unit}")
            elif amount:
                main_ingredients.append(f"{name} {amount}")
            else:
                main_ingredients.append(name)
    
    # Format sub ingredients
    sub_ingredients = []
    for ing in sub_ingredients_list:
        name = ing.get('name', '').strip()
        amount = ing.get('amount', '')
        unit = ing.get('unit', '').strip()
        if name:
            if amount and unit:
                sub_ingredients.append(f"{name} {amount}{unit}")
            elif amount:
                sub_ingredients.append(f"{name} {amount}")
            else:
                sub_ingredients.append(name)
    
    main_text = ', '.join(main_ingredients) if main_ingredients else '(주재료 없음)'
    sub_text = ', '.join(sub_ingredients) if sub_ingredients else '(양념 없음)'
    
    text = f"""[요리명: {title} - 필요 재료 목록]
주재료: {main_text}
양념 및 부재료: {sub_text}"""
    
    return text


def create_process_chunk(recipe: Dict[str, Any], max_tokens: int = 500) -> List[str]:
    """
    Type C: Process Chunk
    목적: 구체적 방법 질문 대응 ("연근조림 어떻게 만들어?", "불 조절은 어떻게 해?")
    전략: 전체 과정이 500토큰 미만이면 하나로 합치고, 길면 phase 단위로 분할
    Uses cleaned data from planning_result.process[].description
    """
    meta = recipe.get('meta', {})
    title = meta.get('title', '') or recipe.get('title', '')
    process_steps = recipe.get('process', [])
    
    if not process_steps:
        return []
    
    # Get descriptions from cleaned process steps
    step_descriptions = []
    for step in process_steps:
        desc = step.get('description', '').strip()
        if desc:
            step_descriptions.append(desc)
    
    if not step_descriptions:
        return []
    
    # Simple token estimation: ~4 tokens per Korean character
    total_chars = sum(len(desc) for desc in step_descriptions)
    estimated_tokens = total_chars * 4
    
    chunks = []
    
    if estimated_tokens < max_tokens:
        # Single chunk for all steps
        steps_text = '\n'.join([f"{i+1}. {desc}" for i, desc in enumerate(step_descriptions)])
        chunk = f"""[요리명: {title} - 조리 방법]
{steps_text}"""
        chunks.append(chunk)
    else:
        # Split by phase (preparation, cooking, finishing) if available
        # Group steps by phase
        phases = {}
        for i, step in enumerate(process_steps):
            phase = step.get('phase', 'cooking')
            if phase not in phases:
                phases[phase] = []
            phases[phase].append((i, step.get('description', '').strip()))
        
        # Create chunks by phase
        for phase, phase_steps in phases.items():
            if not phase_steps:
                continue
            
            phase_names = {
                'preparation': '준비',
                'cooking': '조리',
                'finishing': '마무리'
            }
            phase_name = phase_names.get(phase, phase)
            
            steps_text = '\n'.join([f"{idx+1}. {desc}" for idx, desc in phase_steps if desc])
            if steps_text:
                chunk = f"""[요리명: {title} - {phase_name} 과정]
{steps_text}"""
                chunks.append(chunk)
        
        # If no phase grouping worked, fallback to size-based chunking
        if not chunks:
            chunk_size = 5
            for i in range(0, len(step_descriptions), chunk_size):
                chunk_steps = step_descriptions[i:i+chunk_size]
                steps_text = '\n'.join([f"{i+j+1}. {desc}" for j, desc in enumerate(chunk_steps)])
                chunk = f"""[요리명: {title} - 조리 방법 (단계 {i+1}-{min(i+chunk_size, len(step_descriptions))})]
{steps_text}"""
                chunks.append(chunk)
    
    return chunks


def create_chunks_for_recipe(recipe: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Create all chunk types for a recipe from cleaned data.
    Returns list of chunks with metadata.
    """
    chunks = []
    recipe_id = recipe.get('recipe_id', '')
    meta = recipe.get('meta', {})
    title = meta.get('title', '') or recipe.get('title', '')
    
    # Type A: Summary Chunk
    summary_text = create_summary_chunk(recipe)
    chunks.append({
        'text': summary_text,
        'type': 'summary',
        'recipe_id': recipe_id,
        'title': title,
        'metadata': {
            'difficulty': meta.get('difficulty', ''),
            'time_estimate': meta.get('time_estimate', ''),
            'servings': meta.get('servings', '')
        }
    })
    
    # Type B: Ingredient Chunk
    ingredient_text = create_ingredient_chunk(recipe)
    ingredients_data = recipe.get('ingredients', {})
    
    # Extract ingredient names from cleaned data
    ingredient_names = []
    for ing in ingredients_data.get('main', []):
        name = ing.get('name', '').strip()
        if name:
            ingredient_names.append(name)
    for ing in ingredients_data.get('sub', []):
        name = ing.get('name', '').strip()
        if name:
            ingredient_names.append(name)
    
    chunks.append({
        'text': ingredient_text,
        'type': 'ingredients',
        'recipe_id': recipe_id,
        'title': title,
        'metadata': {
            'ingredient_names': ingredient_names
        }
    })
    
    # Type C: Process Chunks (may be multiple)
    process_chunks = create_process_chunk(recipe)
    for i, process_text in enumerate(process_chunks):
        chunks.append({
            'text': process_text,
            'type': 'process',
            'recipe_id': recipe_id,
            'title': title,
            'metadata': {
                'chunk_index': i
            }
        })
    
    return chunks


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
    
    # 3. Create chunks for each recipe (Phase 3: New Chunking Strategy)
    print("\n📝 청크 생성 중 (Type A: Summary, Type B: Ingredients, Type C: Process)...")
    chunks = []
    chunk_metadata = []
    
    for i, recipe in enumerate(recipes, 1):
        recipe_chunks = create_chunks_for_recipe(recipe)
        
        for chunk in recipe_chunks:
            chunks.append(chunk['text'])
            chunk_metadata.append({
                'recipe_id': chunk['recipe_id'],
                'title': chunk['title'],
                'type': chunk['type'],
                'metadata': chunk['metadata'],
                'text_preview': chunk['text'][:200] + '...'
            })
        
        if i % 20 == 0:
            total_chunks = len(chunks)
            print(f"   진행: {i}/{len(recipes)} 레시피, {total_chunks}개 청크 생성됨")
    
    print(f"✅ {len(chunks)}개의 청크 생성 완료 (레시피 {len(recipes)}개)")
    print(f"   - Type A (Summary): {sum(1 for m in chunk_metadata if m['type'] == 'summary')}개")
    print(f"   - Type B (Ingredients): {sum(1 for m in chunk_metadata if m['type'] == 'ingredients')}개")
    print(f"   - Type C (Process): {sum(1 for m in chunk_metadata if m['type'] == 'process')}개\n")
    
    texts = chunks
    metadata = chunk_metadata
    
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