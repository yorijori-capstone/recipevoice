from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from ..core.deps import pg_conn
from ..db.postgres import get_recipe, get_recipe_steps
from ..services.planner import build_plan


router = APIRouter()


@router.post("/plan/{recipe_id}")
def plan_recipe(recipe_id: str, payload: dict = Body(...)):
    try:
        servings = int(payload.get("servings", 0)) if payload else 0
        with pg_conn() as conn:
            rec = get_recipe(conn, recipe_id)
            if not rec:
                raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다")
            steps = get_recipe_steps(conn, recipe_id)
        return build_plan(rec, steps, servings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"플랜 생성 실패: {e}")
