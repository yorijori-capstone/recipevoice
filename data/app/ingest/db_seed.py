"""Seed database with a single JSON recipe for quick testing."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import yaml

from data.app.ingest._upsert_utils import (
    get_conn,
    upsert_chunk,
    upsert_recipe,
    upsert_recipe_doc,
    upsert_step,
)


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def main(json_filename: str = "recipe_6873683.json") -> None:
    root = Path(__file__).resolve().parents[2]
    cfg_path = root / "config.yaml"
    with cfg_path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

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
            recipe_id=_gen_id("rec"),
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

        for index, step_text in enumerate(data.get("steps", []), start=1):
            step_id = upsert_step(
                cur=cur,
                step_id=_gen_id("stp"),
                recipe_id=recipe_id,
                step_no=index,
                text=step_text,
            )
            upsert_chunk(
                cur=cur,
                chunk_id=_gen_id("chk"),
                recipe_id=recipe_id,
                step_id=step_id,
                step_no=index,
                section="step",
                text=step_text,
            )

        conn.commit()
        print(f"Inserted recipe: {data.get('title')} -> {recipe_id}")


if __name__ == "__main__":
    main()
