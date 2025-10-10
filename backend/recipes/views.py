from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .models import Recipe, Ingredient, Step
from .serializers import RecipeListSerializer, RecipeDetailSerializer, IngredientSerializer, StepSerializer
from core import clients
import base64


class RecipeListView(generics.ListAPIView):
    queryset = Recipe.objects.all().order_by('-created_at')
    serializer_class = RecipeListSerializer


class RecipeDetailView(generics.RetrieveAPIView):
    queryset = Recipe.objects.prefetch_related('ingredients', 'steps').all()
    serializer_class = RecipeDetailSerializer
    lookup_field = 'source_id'


class SearchView(APIView):
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


@method_decorator(csrf_exempt, name='dispatch')
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
            elif action == 'recognize_command':
                return self.recognize_command(request)
            elif action == 'stop':
                request.session.flush()
                return Response({"message": "Guidance stopped"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        except clients.APIClientError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def recognize_command(self, request):
        audio_base64 = request.data.get('audio_base64')
        if not audio_base64:
            return Response({"error": "audio_base64 is required for recognize_command action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            audio_data = base64.b64decode(audio_base64)
            command_text = clients.recognize_speech(audio_data)

            # Map command text to simple navigation or complex control command
            if "다음" in command_text:
                return self.navigate_step(request, "next")
            elif "이전" in command_text:
                return self.navigate_step(request, "prev")
            
            # More complex commands are handled by the LLM server
            else:
                command_map = {
                    "다시": "retry",
                    "뭐라고": "clarify",
                    "멈춰": "pause",
                    "계속": "resume"
                }
                # Find the first matching command
                action = next((cmd for kor, cmd in command_map.items() if kor in command_text), None)

                if not action:
                    # If no command is recognized, repeat the current step
                    return self.navigate_step(request, "repeat")

                # Get current step data from session to send to the control API
                planned_recipe = request.session.get('planned_recipe')
                current_step_index = request.session.get('current_step', 0)
                
                if not planned_recipe or not (0 <= current_step_index < len(planned_recipe.get('planned_steps', []))):
                    return self.navigate_step(request, "repeat") # Fallback
                
                current_step_data = planned_recipe['planned_steps'][current_step_index]

                # Call the new control command handler
                response_data = clients.handle_control_command(action, current_step_data)
                text_to_speak = response_data.get("message", "오류가 발생했습니다.")
                
                # Generate speech and send response directly
                audio_content = clients.generate_speech(text_to_speak)
                return Response({
                    'text': text_to_speak,
                    'audio_base64': base64.b64encode(audio_content).decode('utf-8'),
                    'steps': [step['script'] for step in planned_recipe.get('planned_steps', [])],
                    'current_step_index': current_step_index
                })

        except Exception as e:
            return Response({"error": f"Error processing audio: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def start_guidance(self, request):
        recipe_id = request.data.get('recipe_id')
        if not recipe_id:
            return Response({"error": "recipe_id is required for start action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipe = Recipe.objects.prefetch_related('ingredients', 'steps').get(source_id=recipe_id)
        except Recipe.DoesNotExist:
            return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

        recipe_data = {
            "title": recipe.title,
            "ingredients": IngredientSerializer(recipe.ingredients.all(), many=True).data,
            "steps": StepSerializer(recipe.steps.all(), many=True).data
        }

        planned_recipe = clients.plan_recipe_for_voice(recipe_data)

        request.session['planned_recipe'] = planned_recipe
        request.session['current_step'] = 0

        text_to_speak = planned_recipe.get('opening_remark')
        planned_steps = planned_recipe.get('planned_steps', [])
        if not text_to_speak and planned_steps:
            text_to_speak = planned_steps[0]['script']

        if not text_to_speak:
            text_to_speak = "요리 정보가 없습니다."

        audio_content = clients.generate_speech(text_to_speak)

        return Response({
            'text': text_to_speak,
            'audio_base64': base64.b64encode(audio_content).decode('utf-8'),
            'steps': [step['script'] for step in planned_steps],
            'current_step_index': 0
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
        else:  # current_step < 0
            text_to_speak = planned_recipe.get('opening_remark', "요리를 시작합니다.")

        audio_content = clients.generate_speech(text_to_speak)

        return Response({
            'text': text_to_speak,
            'audio_base64': base64.b64encode(audio_content).decode('utf-8'),
            'steps': [step['script'] for step in planned_recipe.get('planned_steps', [])],
            'current_step_index': current_step
        })
