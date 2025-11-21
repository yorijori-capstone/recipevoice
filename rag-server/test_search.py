"""Test search functionality."""
from tools.search import search_recipes, search_with_details
from tools.recipes import get_recipe_detail

# Test 1: Search
print("=== Test 1: Search ===")
results = search_with_details("김치찌개", top_k=3)
for r in results:
    print(f"- {r['title']} (score: {r['score']:.3f})")

# Test 2: Get detail
print("\n=== Test 2: Recipe Detail ===")
if results:
    recipe_id = results[0]['recipe_id']
    detail = get_recipe_detail(recipe_id)
    print(f"Title: {detail['title']}")
    print(f"Ingredients: {len(detail['ingredients'])}개")
    print(f"Steps: {len(detail['steps'])}개")