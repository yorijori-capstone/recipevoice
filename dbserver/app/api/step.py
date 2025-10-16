from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from ..core.deps import sqlite_conn
from ..db.sqlite import get_recipe_steps
from ..services.stepper import next_step


router = APIRouter()


@router.post("/step/next")
def step_next(payload: dict = Body(...)):
    try:
        recipe_id = int(payload.get("recipe_id"))
        current = int(payload.get("current", 0))
        with sqlite_conn() as conn:
            steps = get_recipe_steps(conn, recipe_id)
        result = next_step(current, total_steps=len(steps))
        next_no = result["next_no"]
        instruction = None
        if 1 <= next_no <= len(steps):
            instruction = steps[next_no - 1].get("text")
        return {"next_no": next_no, "instruction": instruction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스텝 진행 실패: {e}")
