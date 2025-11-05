"""Quick inspection of PostgreSQL tables for debugging."""

import psycopg

from data.app.config_loader import load_config

CFG = load_config("config.yaml")

DB_CFG = CFG.get("database")
if not DB_CFG:
    raise RuntimeError("database configuration missing in config.yaml")

with psycopg.connect(
    dbname=DB_CFG.get("name"),
    user=DB_CFG.get("user"),
    password=DB_CFG.get("password"),
    host=DB_CFG.get("host", "127.0.0.1"),
    port=DB_CFG.get("port", 5432),
) as conn:
    with conn.cursor() as cur:
        print("[recipes]")
        cur.execute("SELECT recipe_id, title, source, total_time FROM recipe")
        for row in cur.fetchall():
            print(row)

        print("\n[steps]")
        cur.execute("SELECT step_id, recipe_id, step_no, text FROM step ORDER BY recipe_id, step_no")
        for row in cur.fetchall():
            print(row)

        print("\n[chunks]")
        cur.execute("SELECT chunk_id, recipe_id, section, text FROM chunk ORDER BY recipe_id, step_no")
        for row in cur.fetchall():
            print(row)
