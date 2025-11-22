"""Recipe detail fetching from PostgreSQL."""

import psycopg
from psycopg.rows import dict_row
from typing import Dict, Any, Optional, List
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data.app.config_loader import load_config

CFG = load_config(ROOT_DIR / "config.yaml")
DB_CFG = CFG.get("database", {})


def _get_conn() -> psycopg.Connection:
    """Get database connection."""
    return psycopg.connect(
        dbname=DB_CFG.get("name"),
        user=DB_CFG.get("user"),
        password=DB_CFG.get("password"),
        host=DB_CFG.get("host", "localhost"),
        port=DB_CFG.get("port", 5432),
        row_factory=dict_row
    )


def get_recipe_detail(recipe_id: str) -> Optional[Dict[str, Any]]:
    """
    Get full recipe details including ingredients and steps.
    
    Args:
        recipe_id: Recipe ID (e.g., "913370")
        
    Returns:
        Recipe dict with ingredients and steps, or None if not found
    """
    with _get_conn() as conn, conn.cursor() as cur:
        # Get recipe
        cur.execute(
            "SELECT * FROM recipes WHERE recipe_id = %s",
            (recipe_id,)
        )
        recipe = cur.fetchone()
        
        if not recipe:
            return None
        
        recipe = dict(recipe)
        
        # Get ingredients
        cur.execute(
            """
            SELECT name, quantity, description, display_order
            FROM ingredients
            WHERE recipe_id = %s
            ORDER BY display_order
            """,
            (recipe_id,)
        )
        recipe['ingredients'] = [dict(row) for row in cur.fetchall()]
        
        # Get steps
        cur.execute(
            """
            SELECT step_number, description
            FROM steps
            WHERE recipe_id = %s
            ORDER BY step_number
            """,
            (recipe_id,)
        )
        recipe['steps'] = [dict(row) for row in cur.fetchall()]
        
        return recipe


def get_recipes_by_ids(recipe_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Get multiple recipe summaries by IDs.
    
    Args:
        recipe_ids: List of recipe IDs
        
    Returns:
        List of recipe dicts (without ingredients/steps)
    """
    if not recipe_ids:
        return []
    
    with _get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT recipe_id, title, servings, cook_time, difficulty
            FROM recipes
            WHERE recipe_id = ANY(%s)
            """,
            (recipe_ids,)
        )
        return [dict(row) for row in cur.fetchall()]