from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Recipe, Ingredient, Step
from .serializers import RecipeListSerializer, RecipeDetailSerializer, IngredientSerializer, StepSerializer
from core import clients
import base64


class RecipeListView(generics.ListAPIView):
    """
    모든 레시피의 목록을 반환하는 API 뷰
    """
    queryset = Recipe.objects.all().order_by('-created_at')
    serializer_class = RecipeListSerializer


class RecipeDetailView(generics.RetrieveAPIView):
    """
    특정 레시피의 상세 정보를 반환하는 API 뷰
    """
    queryset = Recipe.objects.prefetch_related('ingredients', 'steps').all()
    serializer_class = RecipeDetailSerializer
    lookup_field = 'source_id'


class SearchView(APIView):
    """
    RAG 서버와 연동하여 레시피를 검색하는 API 뷰
    """
    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', None)
        if not query:
            return Response({"error": "'q' 쿼리 파라미터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            recipe_ids = clients.search_rag(query)
            if not recipe_ids:
                return Response([], status=status.HTTP_200_OK)
            recipes = Recipe.objects.filter(source_id__in=recipe_ids)
            recipes_dict = {recipe.source_id: recipe for recipe in recipes}
            ordered_recipes = [recipes_dict[id] for id in recipe_ids if id in recipes_dict]
            serializer = RecipeListSerializer(ordered_recipes, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except clients.APIClientError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class VoiceControlView(APIView):
    """
    음성 안내 흐름을 제어하는 API 뷰 (오케스트레이터)
    """
    def post(self, request, *args, **kwargs):
        action = request.data.get('action')

        try:
            if action == 'start':
                return self.start_guidance(request)
            elif action in ['next', 'prev', 'repeat']:
                return self.navigate_step(request, action)
            elif action == 'stop':
                # 세션 클리어
                request.session.flush()
                return Response({"message": "Guidance stopped"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        except clients.APIClientError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def start_guidance(self, request):
        recipe_id = request.data.get('recipe_id')
        if not recipe_id:
            return Response({"error": "recipe_id is required for start action"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. DB에서 레시피 정보 가져오기
        try:
            recipe = Recipe.objects.prefetch_related('ingredients', 'steps').get(pk=recipe_id)
        except Recipe.DoesNotExist:
            return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

        # 2. 플래닝 서버에 보낼 데이터 직렬화
        recipe_data = {
            "title": recipe.title,
            "ingredients": IngredientSerializer(recipe.ingredients.all(), many=True).data,
            "steps": StepSerializer(recipe.steps.all(), many=True).data
        }

        # 3. 플래닝 서버 호출
        planned_recipe = clients.plan_recipe_for_voice(recipe_data)

        # 4. 세션에 정보 저장
        request.session['planned_recipe'] = planned_recipe
        request.session['current_step'] = 0

        # 5. 첫 음성(오프닝 또는 첫 단계) 생성 및 반환
        text_to_speak = planned_recipe.get('opening_remark') or planned_recipe['planned_steps'][0]['script']
        audio_content = clients.generate_speech(text_to_speak)

        return Response({
            'text': text_to_speak,
            'audio_base64': base64.b64encode(audio_content).decode('utf-8')
        })

    def navigate_step(self, request, action):
        planned_recipe = request.session.get('planned_recipe')
        current_step = request.session.get('current_step', 0)

        if not planned_recipe:
            return Response({"error": "Guidance not started. Please send 'start' action first."}, status=status.HTTP_400_BAD_REQUEST)

        steps = planned_recipe.get('planned_steps', [])
        if action == 'next':
            current_step += 1
        elif action == 'prev':
            current_step = max(0, current_step - 1)
        
        request.session['current_step'] = current_step

        if 0 <= current_step < len(steps):
            text_to_speak = steps[current_step]['script']
        elif current_step >= len(steps):
            text_to_speak = planned_recipe.get('closing_remark', "요리가 완료되었습니다.")
        else:
            text_to_speak = planned_recipe.get('opening_remark', steps[0]['script'])

        audio_content = clients.generate_speech(text_to_speak)

        return Response({
            'text': text_to_speak,
            'audio_base64': base64.b64encode(audio_content).decode('utf-8')
        })
