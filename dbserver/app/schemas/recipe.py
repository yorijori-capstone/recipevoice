from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class Recipe(BaseModel):
    recipe_id: str | None = None
    title: str | None = None
    servings: str | None = None
    source: str | None = None


class RecipeStep(BaseModel):
    recipe_id: str | None = None
    step_no: int
    text: str | None = None
    time_hint_sec: int | None = None
    warnings_json: str | None = None


class RecipeDetailResponse(BaseModel):
    recipe: Recipe
    steps: List[RecipeStep]
