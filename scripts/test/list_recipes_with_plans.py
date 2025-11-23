import os
import sys
import psycopg2
from pathlib import Path

# Add backend to path
ROOT = Path(__file__).resolve().parent
sys.path.append(str(ROOT / "backend"))

# Load config
import yaml
config_path = ROOT / "config.yaml"
with open(config_path, "r", encoding="utf-8") as f:
    cfg = yaml.safe_load(f)

db_cfg = cfg["database"]

# Connect
conn = psycopg2.connect(
    host=db_cfg["host"],
    port=db_cfg["port"],
    user=db_cfg["user"],
    password=db_cfg["password"],
    dbname=db_cfg["name"]
)
cur = conn.cursor()

# Get recipes with voice plans
cur.execute("""
    SELECT r.recipe_id, r.title 
    FROM recipe r
    INNER JOIN recipe_voice_plan v ON r.recipe_id = v.recipe_id
    ORDER BY v.created_at DESC
    LIMIT 10
""")

recipes = cur.fetchall()

print(f"\n✓ Found {len(recipes)} recipes with voice plans:\n")
for recipe_id, title in recipes:
    print(f"  - {recipe_id}: {title}")

conn.close()
