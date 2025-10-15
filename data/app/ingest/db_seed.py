import sqlite3, uuid, json, os, yaml

def gen_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"

with open("config.yaml", "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

DB_PATH = CFG["paths"]["sqlite_path"]
RAW_DIR = CFG["paths"]["raw_data_dir"]
JSON_FILE = os.path.join(RAW_DIR, "recipe_6873683.json")

# JSON 로드
with open(JSON_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

with sqlite3.connect(DB_PATH) as conn:
    conn.execute("PRAGMA foreign_keys=ON;")
    cur = conn.cursor()

    recipe_id = gen_id("rec")

    # servings / cook_time 정리
    servings = None
    if "servings" in data and data["servings"]:
        servings = int(
            data["servings"]
            .replace("인분", "")
            .replace(" ", "")
            .replace("~", "")
            .replace("+", "")
            .replace("이상", "")
            or 0
        )

    cook_time = None
    if "cook_time" in data and data["cook_time"]:
        cook_time = int(
            data["cook_time"]
            .replace("분", "")
            .replace("이내", "")
            .replace("약", "")
            .replace(" ", "")
            or 0
        )

    # recipe 테이블
    cur.execute("""
      INSERT INTO recipe(recipe_id, title, source, external_id, author, servings, total_time_min)
      VALUES(?,?,?,?,?,?,?)
    """, (
        recipe_id,
        data["title"],
        "web",
        data.get("recipe_id"),
        data.get("copyright"),
        servings,
        cook_time
    ))

    # recipe_doc
    cur.execute("""
      INSERT INTO recipe_doc(recipe_id, source_url, raw_json)
      VALUES(?,?,?)
    """, (recipe_id, data.get("source_url"), json.dumps(data, ensure_ascii=False)))

    # steps → step + chunk
    for i, step_text in enumerate(data.get("steps", []), start=1):
        step_id = gen_id("stp")
        chunk_id = gen_id("chk")
        cur.execute("""
          INSERT INTO step(step_id, recipe_id, step_no, text)
          VALUES(?,?,?,?)
        """, (step_id, recipe_id, i, step_text))
        cur.execute("""
          INSERT INTO chunk(chunk_id, recipe_id, step_id, section, text)
          VALUES(?,?,?,?,?)
        """, (chunk_id, recipe_id, step_id, "step", step_text))

    conn.commit()
    print("Inserted recipe:", data["title"], "->", recipe_id)
