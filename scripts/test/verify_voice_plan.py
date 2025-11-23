import os
import sys
import django
import json

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from recipes.models import RecipeVoicePlan

def verify():
    recipe_id = "rec-8bad47c2555e"
    try:
        plan = RecipeVoicePlan.objects.get(recipe_id=recipe_id)
        print(f"Found plan for {recipe_id}")
        data = json.loads(plan.plan_json)
        print(f"Title: {data.get('title')}")
        print(f"Steps count: {len(data.get('planned_steps', []))}")
        print("Verification SUCCESS")
    except RecipeVoicePlan.DoesNotExist:
        print(f"Plan not found for {recipe_id}")
        print("Verification FAILED")

if __name__ == "__main__":
    verify()
