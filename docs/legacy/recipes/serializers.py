# backend/recipes/serializers.py
from rest_framework import serializers
from .models import Recipe, Step, Chunk

class StepSerializer(serializers.ModelSerializer):
    """
    (프론트엔드용) 조리 단계 정보 Serializer
    """
    class Meta:
        model = Step
        fields = ['step_no', 'text', 'time_hint_sec']

class LLMStepSerializer(serializers.ModelSerializer):
    """
    (LLM 서버용) 조리 단계 정보 Serializer
    LLM 서버의 `Step` 스키마에 맞게 필드 이름을 변경합니다.
    """
    order = serializers.IntegerField(source='step_no')
    instruction = serializers.CharField(source='text')

    class Meta:
        model = Step
        fields = ['order', 'instruction']

class IngredientSerializer(serializers.ModelSerializer):
    """
    (프론트엔드용) 재료 정보 Serializer
    Chunk 모델의 text 필드를 name으로 사용합니다.
    """
    name = serializers.CharField(source='text')

    class Meta:
        model = Chunk
        fields = ['name']

class RecipeDetailSerializer(serializers.ModelSerializer):
    """
    레시피 상세 정보 Serializer (읽기 전용)
    - 관련된 단계(steps)와 재료(ingredients)를 포함합니다.
    """
    steps = StepSerializer(many=True, read_only=True, source='step_set')
    ingredients = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'recipe_id',
            'title',
            'servings',
            'total_time',
            'difficulty',
            'author',
            'source',
            'ingredients', # 추가
            'steps'
        ]
    
    def get_ingredients(self, obj):
        """
        현재 레시피(obj)에 연결된 Chunk 중 section='ingredients'인 것들을 조회합니다.
        """
        ingredient_chunks = Chunk.objects.filter(recipe=obj, section='ingredients')
        return IngredientSerializer(ingredient_chunks, many=True).data

class RecipeListSerializer(serializers.ModelSerializer):
    """
    레시피 목록을 위한 간단한 Serializer
    """
    class Meta:
        model = Recipe
        fields = ['recipe_id', 'title', 'difficulty', 'total_time']
