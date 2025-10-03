import json
import sqlite3
from django.conf import settings
from django.core.management.base import BaseCommand
from recipes.models import Recipe, Ingredient, Step
from django.db import transaction

def reset_recipe_tables():
    """
    Connects to the SQLite database and manually drops and recreates recipe-related tables.
    """
    db_path = settings.DATABASES['default']['NAME']
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop tables if they exist
    cursor.execute("DROP TABLE IF EXISTS recipes_ingredient;")
    cursor.execute("DROP TABLE IF EXISTS recipes_step;")
    cursor.execute("DROP TABLE IF EXISTS recipes_recipe;")

    # Create Recipe table
    cursor.execute("""
    CREATE TABLE recipes_recipe (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        source_url VARCHAR(512),
        servings VARCHAR(50) NOT NULL,
        cook_time VARCHAR(50) NOT NULL,
        difficulty VARCHAR(50) NOT NULL,
        copyright_holder VARCHAR(100) NOT NULL,
        tips TEXT NOT NULL,
        created_at DATETIME NOT NULL
    );
    """)

    # Create Ingredient table
    cursor.execute("""
    CREATE TABLE recipes_ingredient (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        quantity VARCHAR(100) NOT NULL,
        recipe_id BIGINT NOT NULL REFERENCES recipes_recipe(id) DEFERRABLE INITIALLY DEFERRED
    );
    """)
    cursor.execute("CREATE INDEX recipes_ingredient_recipe_id_idx ON recipes_ingredient (recipe_id);")


    # Create Step table
    cursor.execute("""
    CREATE TABLE recipes_step (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        "order" INTEGER UNSIGNED NOT NULL CHECK ("order" >= 0),
        instruction TEXT NOT NULL,
        recipe_id BIGINT NOT NULL REFERENCES recipes_recipe(id) DEFERRABLE INITIALLY DEFERRED
    );
    """)
    cursor.execute("CREATE INDEX recipes_step_recipe_id_idx ON recipes_step (recipe_id);")
    cursor.execute('CREATE UNIQUE INDEX unique_recipe_step_order ON recipes_step (recipe_id, "order");')


    conn.commit()
    conn.close()


class Command(BaseCommand):
    help = 'Loads recipes from a .ndjson file into the database'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Forcefully resetting database schema..."))
        reset_recipe_tables()
        self.stdout.write(self.style.SUCCESS("Database schema reset complete."))

        file_path = 'data/recipes/all_recipes.ndjson'
        self.stdout.write(self.style.SUCCESS(f"Starting to load recipes from {file_path}"))

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
