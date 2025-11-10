from __future__ import annotations

from typing import Dict, List


def build_plan(recipe: dict, steps: List[dict], servings: int) -> dict:
    scaled_steps = []
    for st in steps:
        instruction = st.get("text") or ""
        if servings and recipe.get("servings") and str(servings) != str(recipe.get("servings")):
            instruction = f"[분량 {recipe.get('servings')}→{servings}] " + instruction
        scaled_steps.append(
            {
                "no": int(st.get("step_no") or 0),
                "instruction": instruction,
                "timer": st.get("time_hint_sec"),
                "caution": st.get("warnings_json"),
            }
        )

    # TODO: 실제 재료/단위 스케일링 로직 추가
    return {
        "recipe_id": recipe.get("recipe_id"),
        "title": recipe.get("title"),
        "servings": servings or recipe.get("servings"),
        "steps": scaled_steps,
    }
