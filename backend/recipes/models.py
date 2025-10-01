from django.db import models

# Create your models here.

class Recipe(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Ingredient(models.Model):
    recipe = models.ForeignKey(Recipe, related_name="ingredients", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    amount = models.CharField(max_length=50)  # 예: "2컵", "1스푼"

    def __str__(self):
        return f"{self.name} ({self.amount})"


class Step(models.Model):
    recipe = models.ForeignKey(Recipe, related_name="steps", on_delete=models.CASCADE)
    order = models.PositiveIntegerField()
    instruction = models.TextField()

    def __str__(self):
        return f"Step {self.order} for {self.recipe.title}"
