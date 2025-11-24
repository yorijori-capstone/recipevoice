"""Seed database with a single JSON recipe for quick testing."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

from data.app.config_loader import load_config

import sys
# Add backend to sys.path to import clients
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(os.path.join(ROOT, "backend"))
from core import clients

from data.app.ingest._upsert_utils import (
    get_conn,
    upsert_chunk,
    upsert_recipe,
    upsert_recipe_doc,
    upsert_step,
    upsert_voice_plan,
)


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def main(json_filename: str = "recipe_6873683.json") -> None:
    root = Path(__file__).resolve().parents[3]
    cfg_path = root / "config.yaml"
    cfg = load_config(cfg_path)

    raw_dir = root / cfg["paths"]["raw_data_dir"]
    json_file = raw_dir / json_filename

    with json_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    servings = data.get("servings")
    total_time = data.get("cook_time")

    with get_conn() as conn:
        cur = conn.cursor()

        recipe_id = upsert_recipe(
            cur=cur,
            recipe_id=None,
            title=data.get("title", "Untitled"),
            source=data.get("source", "web"),
            external_id=data.get("recipe_id"),
            author=data.get("copyright"),
            servings=str(servings) if servings is not None else None,
            total_time=str(total_time) if total_time is not None else None,
            difficulty=data.get("difficulty"),
        )

        upsert_recipe_doc(
            cur=cur,
            recipe_id=recipe_id,
            source_url=data.get("source_url"),
            raw_json=json.dumps(data, ensure_ascii=False),
        )

        norm_steps = []
        for index, step_text in enumerate(data.get("steps", []), start=1):
            norm_steps.append({"text": step_text})
            step_id = upsert_step(
                cur=cur,
                step_id=None,
                recipe_id=recipe_id,
                step_no=index,
                text=step_text,
            )
            upsert_chunk(
                cur=cur,
                chunk_id=None,
                recipe_id=recipe_id,
                step_id=step_id,
                step_no=index,
                section="step",
                text=step_text,
            )

        # Voice Planning
        try:
            print(f"[PLAN] Generating voice plan for {data.get('title')}...")
            
            # Format ingredients
            ingredients_payload = []
            if "ingredients_struct" in data:
                for item in data["ingredients_struct"]:
                    ingredients_payload.append({
                        "name": item.get("name", ""),
                        "quantity": item.get("qty", "")
                    })
            else:
                # Fallback: use string list
                for item in data.get("ingredients", []):
                    ingredients_payload.append({
                        "name": item,
                        "quantity": "" 
                    })

            # Format steps
            steps_payload = []
            for idx, step_text in enumerate(data.get("steps", []), start=1):
                steps_payload.append({
                    "order": idx,
                    "instruction": step_text
                })

            recipe_data_for_plan = {
                "title": data.get("title", "Untitled"),
                "ingredients": ingredients_payload,
                "steps": steps_payload
            }
            plan_result = clients.plan_recipe_for_voice(recipe_data_for_plan)
            upsert_voice_plan(
                cur=cur,
                recipe_id=recipe_id,
                plan_json=json.dumps(plan_result, ensure_ascii=False)
            )
            print(f"[PLAN] Saved voice plan for {recipe_id}")
        except Exception as e:
            print(f"[WARN] Voice planning failed: {e}")

        conn.commit()
        print(f"Inserted recipe: {data.get('title')} -> {recipe_id}")


if __name__ == "__main__":
    main()
