from rest_framework import serializers
from .models import Recipe, Ingredient, Step


class IngredientSerializer(serializers.ModelSerializer):
    """
    재료 정보 Serializer
    """
    class Meta:
        model = Ingredient
        fields = ['name', 'quantity']


class StepSerializer(serializers.ModelSerializer):
    """
    조리 단계 정보 Serializer
    """
    class Meta:
        model = Step
        fields = ['order', 'instruction']


class RecipeDetailSerializer(serializers.ModelSerializer):
    """
    레시피 상세 정보 Serializer (읽기 전용)
    - 관련된 재료(ingredients)와 단계(steps)를 포함합니다.
    """
    ingredients = IngredientSerializer(many=True, read_only=True)
    steps = StepSerializer(many=True, read_only=True)

    class Meta:
        model = Recipe
        fields = [
            'source_id',
            'title',
            'servings',
            'cook_time',
            'difficulty',
            'tips',
            'source_url',
            'ingredients',  # Nested Serializer
            'steps'         # Nested Serializer
        ]


class RecipeListSerializer(serializers.ModelSerializer):
    """
    레시피 목록을 위한 간단한 Serializer
    """
    class Meta:
        model = Recipe
        fields = ['source_id', 'title', 'difficulty', 'cook_time']