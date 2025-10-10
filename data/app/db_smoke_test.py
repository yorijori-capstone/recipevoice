import sqlite3, yaml

with open("config.yaml", "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

DB_PATH = CFG["paths"]["sqlite_path"]

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

print("[recipes]")
for r in conn.execute("SELECT recipe_id, title, source, total_time FROM recipe"):
    print(dict(r))

print("\n[steps]")
for r in conn.execute("SELECT step_id, recipe_id, step_no, text FROM step ORDER BY step_no"):
    print(dict(r))

print("\n[chunks]")
for r in conn.execute("SELECT rowid, chunk_id, section, text FROM chunk"):
    print(dict(r))

conn.close()
