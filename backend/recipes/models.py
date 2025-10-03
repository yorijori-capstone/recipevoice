from django.db import models

class Recipe(models.Model):
    """
    레시피의 핵심 정보를 저장하는 모델
    """
    source_id = models.CharField(max_length=50, unique=True, help_text="크롤링 소스의 레시피 ID")
    title = models.CharField(max_length=255)
    source_url = models.URLField(max_length=512, blank=True, null=True)
    servings = models.CharField(max_length=50, blank=True)
    cook_time = models.CharField(max_length=50, blank=True)
    difficulty = models.CharField(max_length=50, blank=True)
    copyright_holder = models.CharField(max_length=100, blank=True)
    tips = models.JSONField(default=list, blank=True, help_text="요리 팁 목록")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']

class Ingredient(models.Model):
    """
    레시피에 포함된 각 재료 정보를 저장하는 모델
    """
    recipe = models.ForeignKey(Recipe, related_name="ingredients", on_delete=models.CASCADE)
    name = models.CharField(max_length=255, help_text="재료명")
    quantity = models.CharField(max_length=100, blank=True, help_text="양")

    def __str__(self):
        return f"{self.name} ({self.quantity})"
    
    class Meta:
        ordering = ['id']

class Step(models.Model):
    """
    레시피의 각 조리 단계를 저장하는 모델
    """
    recipe = models.ForeignKey(Recipe, related_name="steps", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(help_text="조리 단계 순서")
    instruction = models.TextField(help_text="조리 방법 설명")

    def __str__(self):
        return f"#{self.order}. {self.instruction[:30]}... ({self.recipe.title})"

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(fields=['recipe', 'order'], name='unique_recipe_step_order')
        ]