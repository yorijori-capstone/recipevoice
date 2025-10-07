import json
from django.core.management.base import BaseCommand
from recipes.models import Recipe, Ingredient, Step
from django.db import transaction

class Command(BaseCommand):
    help = 'Loads recipes from a .ndjson file into the database'

    def handle(self, *args, **options):
        file_path = 'data/recipes/all_recipes.ndjson'
        self.stdout.write(self.style.SUCCESS(f"Starting to load recipes from {file_path}"))

        try:
            with transaction.atomic():
                self.stdout.write("Clearing existing recipe data...")
                Recipe.objects.all().delete()
                self.stdout.write("Done clearing data.")

                with open(file_path, 'r', encoding='utf-8') as f:
                    recipe_count = 0
                    for line in f:
                        try:
                            data = json.loads(line)
                            recipe = Recipe.objects.create(
                                source_id=data['recipe_id'],
                                title=data['title'],
                                source_url=data.get('source_url', ''),
                                servings=data.get('servings', ''),
                                cook_time=data.get('cook_time', ''),
                                difficulty=data.get('difficulty', ''),
                                copyright_holder=data.get('copyright', ''),
                                tips=data.get('tips', [])
                            )
                            ingredients_to_create = []
                            for ing_data in data.get('ingredients_struct', []):
                                ingredients_to_create.append(
                                    Ingredient(recipe=recipe, name=ing_data.get('name', ''), quantity=ing_data.get('qty', ''))
                                )
                            if ingredients_to_create:
                                Ingredient.objects.bulk_create(ingredients_to_create)

                            steps_to_create = []
                            for i, step_desc in enumerate(data.get('steps', [])):
                                steps_to_create.append(
                                    Step(recipe=recipe, order=i + 1, instruction=step_desc)
                                )
                            if steps_to_create:
                                Step.objects.bulk_create(steps_to_create)
                            
                            recipe_count += 1
                            if recipe_count % 100 == 0:
                                self.stdout.write(f"{recipe_count} recipes loaded...")

                        except json.JSONDecodeError:
                            self.stderr.write(self.style.ERROR(f"Skipping malformed line."))
                        except Exception as e:
                            self.stderr.write(self.style.ERROR(f"An error occurred processing a recipe: {e}"))

            self.stdout.write(self.style.SUCCESS(f"\nSuccessfully loaded a total of {recipe_count} recipes into the database."))
        
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Error: The file at {file_path} was not found."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"An unexpected error occurred: {e}"))

        try:
            with transaction.atomic():
                # Clear existing recipe data
                self.stdout.write("Clearing existing recipe data...")
                Recipe.objects.all().delete()
                self.stdout.write("Done clearing data.")

                # Open and read the file
                with open(file_path, 'r', encoding='utf-8') as f:
                    recipe_count = 0
                    for line in f:
                        try:
                            data = json.loads(line)

                            # Create Recipe object
                            recipe = Recipe.objects.create(
                                source_id=data['recipe_id'],
                                title=data['title'],
                                source_url=data.get('source_url', ''),
                                servings=data.get('servings', ''),
                                cook_time=data.get('cook_time', ''),
                                difficulty=data.get('difficulty', ''),
                                copyright_holder=data.get('copyright', ''),
                                tips=data.get('tips', [])
                            )

                            # Bulk create Ingredients
                            ingredients_to_create = []
                            for ing_data in data.get('ingredients_struct', []):
                                ingredients_to_create.append(
                                    Ingredient(
                                        recipe=recipe,
                                        name=ing_data.get('name', ''),
                                        quantity=ing_data.get('qty', '')
                                    )
                                )
                            if ingredients_to_create:
                                Ingredient.objects.bulk_create(ingredients_to_create)

                            # Bulk create Steps
                            steps_to_create = []
                            for i, step_desc in enumerate(data.get('steps', [])):
                                steps_to_create.append(
                                    Step(
                                        recipe=recipe,
                                        order=i + 1,
                                        instruction=step_desc
                                    )
                                )
                            if steps_to_create:
                                Step.objects.bulk_create(steps_to_create)
                            
                            recipe_count += 1
                            if recipe_count % 100 == 0:
                                self.stdout.write(f"{recipe_count} recipes loaded...")

                        except json.JSONDecodeError:
                            self.stderr.write(self.style.ERROR(f"Skipping malformed line."))
                        except Exception as e:
                            self.stderr.write(self.style.ERROR(f"An error occurred processing a recipe: {e}"))

            self.stdout.write(self.style.SUCCESS(f"\nSuccessfully loaded a total of {recipe_count} recipes into the database."))
        
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Error: The file at {file_path} was not found."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"An unexpected error occurred: {e}"))
