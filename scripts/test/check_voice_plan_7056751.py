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

# Check if recipe exists
cur.execute("SELECT recipe_id, title FROM recipe WHERE external_id = %s OR recipe_id LIKE %s", ("7056751", "%7056751%"))
recipe = cur.fetchone()

if recipe:
    print(f"✓ Recipe found: {recipe[0]} - {recipe[1]}")
    
    # Check voice plan
    cur.execute("SELECT plan_json FROM recipe_voice_plan WHERE recipe_id = %s", (recipe[0],))
    plan = cur.fetchone()
    
    if plan:
        print(f"✓ Voice plan exists for this recipe")
        print(f"  Plan preview: {plan[0][:200]}...")
    else:
        print(f"✗ NO voice plan found for this recipe!")
        print(f"  This is why the LLM Planning Server was called.")
else:
    print(f"✗ Recipe with external_id or recipe_id containing '7056751' not found in DB")

conn.close()
