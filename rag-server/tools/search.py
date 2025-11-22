"""RAG search using FAISS and PostgreSQL."""

import faiss
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
import json
import sys
import io

# Windows 인코딩 문제 해결
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data.app.config_loader import load_config
from data.app.emb_local import LocalEmbedder

# Load config
CFG = load_config(ROOT_DIR / "config.yaml")
INDEX_PATH = ROOT_DIR / CFG["paths"]["faiss_index_path"]
MODEL_NAME = CFG["embedding"]["model"]
TOP_K = CFG["faiss"]["top_k"]

# Load resources
print("[RAG] Loading FAISS index and model...")
INDEX = faiss.read_index(str(INDEX_PATH))
EMBEDDER = LocalEmbedder(MODEL_NAME)
print(f"✅ [RAG] Loaded successfully (index size: {INDEX.ntotal})")

# Load metadata
METADATA_PATH = INDEX_PATH.parent / "metadata.json"
with open(METADATA_PATH, 'r', encoding='utf-8') as f:
    METADATA = json.load(f)


def search_recipes(query: str, top_k: int = None) -> List[str]:
    """
    Search recipes by natural language query.
    
    Args:
        query: Search query (e.g., "김치찌개")
        top_k: Number of results (default: from config)
        
    Returns:
        List of recipe IDs
    """
    if top_k is None:
        top_k = TOP_K
    
    print(f"[RAG] Searching for: '{query}' (top_k={top_k})")
    
    # 1. Encode query
    query_vector = EMBEDDER.encode([query])
    faiss.normalize_L2(query_vector)
    
    # 2. Search FAISS
    distances, indices = INDEX.search(query_vector, top_k)
    
    # 3. Get recipe IDs
    recipe_ids = []
    for idx, distance in zip(indices[0], distances[0]):
        if idx < len(METADATA):
            recipe_id = METADATA[idx]['recipe_id']
            recipe_ids.append(recipe_id)
            print(f"   - {METADATA[idx]['title']} (score: {distance:.3f})")
    
    print(f"[RAG] Found {len(recipe_ids)} recipes")
    return recipe_ids


def search_with_details(query: str, top_k: int = None) -> List[Dict[str, Any]]:
    """
    Search recipes and return with metadata (Phase 3: Enhanced with chunk type).
    
    Args:
        query: Search query
        top_k: Number of results
        
    Returns:
        List of dicts with recipe_id, title, score, chunk_type, metadata
    """
    if top_k is None:
        top_k = TOP_K
    
    query_vector = EMBEDDER.encode([query])
    faiss.normalize_L2(query_vector)
    
    distances, indices = INDEX.search(query_vector, top_k)
    
    results = []
    seen_recipe_ids = set()  # Deduplicate by recipe_id
    
    for idx, distance in zip(indices[0], distances[0]):
        if idx < len(METADATA):
            meta = METADATA[idx]
            recipe_id = meta['recipe_id']
            
            # Deduplicate: only add first occurrence of each recipe_id
            if recipe_id not in seen_recipe_ids:
                seen_recipe_ids.add(recipe_id)
                results.append({
                    'recipe_id': recipe_id,
                    'title': meta.get('title', ''),
                    'score': float(distance),
                    'chunk_type': meta.get('type', 'unknown'),
                    'metadata': meta.get('metadata', {})
                })
    
    return results