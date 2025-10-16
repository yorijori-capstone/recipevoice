from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.deps import sqlite_conn
from ..db.sqlite import get_recipe, get_recipe_steps
from ..schemas.recipe import Recipe, RecipeDetailResponse, RecipeStep


router = APIRouter()


@router.get("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe_detail(recipe_id: int):
    try:
        with sqlite_conn() as conn:
            rec = get_recipe(conn, recipe_id)
            if not rec:
                raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다")
            steps = get_recipe_steps(conn, recipe_id)
        return RecipeDetailResponse(
            recipe=Recipe(**rec),
            steps=[RecipeStep(**s) for s in steps],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"레시피 조회 실패: {e}")
