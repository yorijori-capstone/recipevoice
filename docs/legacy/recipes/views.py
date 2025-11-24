# backend/recipes/views.py
import json
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from .models import Recipe, Step, Chunk, RecipeVoicePlan
from .serializers import (
    RecipeListSerializer,
    RecipeDetailSerializer,
    LLMStepSerializer,
    StepSerializer,
)
from core import clients
from core.agent_runner import run_agent_once


def recipes_health_check(request):
    return HttpResponse("RECIPES_OK")


class RecipeListView(generics.ListAPIView):
    queryset = Recipe.objects.all().order_by('-created_at')
    serializer_class = RecipeListSerializer


class RecipeDetailView(generics.RetrieveAPIView):
    queryset = Recipe.objects.prefetch_related('step_set').all()
    serializer_class = RecipeDetailSerializer
    lookup_field = 'recipe_id'


class SearchView(APIView):
    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q')
        if not query:
            return Response({"error": "'q' 쿼리 파라미터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        top_k = request.query_params.get('top_k')
        limit = None
        if top_k:
            try:
                limit = max(1, min(50, int(top_k)))
            except ValueError:
                return Response({"error": "'top_k'는 정수여야 합니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipe_ids = clients.search_rag(query, top_k=limit)
            if not recipe_ids:
                return Response([], status=status.HTTP_200_OK)

            recipes = Recipe.objects.filter(recipe_id__in=recipe_ids)
            recipe_map = {recipe.recipe_id: recipe for recipe in recipes}
            ordered = [recipe_map[rid] for rid in recipe_ids if rid in recipe_map]
            serializer = RecipeListSerializer(ordered, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except clients.APIClientError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@method_decorator(csrf_exempt, name='dispatch')
class LangchainAgentView(APIView):
    def post(self, request, *args, **kwargs):
        user_input = request.data.get('input')
        chat_history = request.data.get('chat_history', '')

        if not user_input:
            return Response({"error": "'input' 필드는 필수입니다."}, status=status.HTTP_400_BAD_REQUEST)

        response_text = run_agent_once(user_input, chat_history)

        return Response({
            "output": response_text,
            "chat_history": chat_history + f"\n사용자: {user_input}\n에이전트: {response_text}"
        })


@method_decorator(csrf_exempt, name='dispatch')
class VoiceControlView(APIView):
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
        recognized_text = request.data.get('recognized_text')
        if not recognized_text:
            return Response({"error": "recognized_text 필드는 필수입니다."}, status=status.HTTP_400_BAD_REQUEST)

        command_text = recognized_text.strip()

        if "다음" in command_text:
            response = self.navigate_step(request, "next")
            response.data['recognized_text'] = command_text
            return response
        if "이전" in command_text:
            response = self.navigate_step(request, "prev")
            response.data['recognized_text'] = command_text
            return response

        command_map = {
            "다시": "retry",
            "뭐라고": "clarify",
            "멈춰": "pause",
            "계속": "resume"
        }
        action = next((cmd for kor, cmd in command_map.items() if kor in command_text), None)
        if not action:
            response = self.navigate_step(request, "repeat")
            response.data['recognized_text'] = command_text
            return response

        planned_recipe = request.session.get('planned_recipe')
        current_step_index = request.session.get('current_step', 0)
        if not planned_recipe or not (0 <= current_step_index < len(planned_recipe.get('planned_steps', []))):
            response = self.navigate_step(request, "repeat")
            response.data['recognized_text'] = command_text
            return response

        current_step_data = planned_recipe['planned_steps'][current_step_index]
        response_data = clients.handle_control_command(action, current_step_data)
        text_to_speak = response_data.get("message", "오류가 발생했습니다.")

        return Response({
            'text': text_to_speak,
            'steps': [step['script'] for step in planned_recipe.get('planned_steps', [])],
            'current_step_index': current_step_index,
            'recognized_text': command_text
        })

    def start_guidance(self, request):
        recipe_id = request.data.get('recipe_id')
        if not recipe_id:
            return Response({"error": "recipe_id is required for start action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipe = Recipe.objects.prefetch_related('step_set').get(recipe_id=recipe_id)
        except Recipe.DoesNotExist:
            return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

        # Try to get pre-planned voice script
        planned_recipe = None
        try:
            voice_plan_obj = RecipeVoicePlan.objects.get(recipe_id=recipe_id)
            if voice_plan_obj.plan_json:
                planned_recipe = json.loads(voice_plan_obj.plan_json)
        except RecipeVoicePlan.DoesNotExist:
            pass

        if not planned_recipe:
            # Fallback to on-demand planning
            steps_queryset = recipe.step_set.all().order_by('step_no')

            ingredient_chunks = Chunk.objects.filter(recipe=recipe, section='ingredients').order_by('step_no')
            ingredients_payload = []
            for chunk in ingredient_chunks:
                text = (chunk.text or "").strip()
                if not text:
                    continue
                name = text
                quantity = ""
                if chunk.meta_json:
                    try:
                        meta = json.loads(chunk.meta_json)
                        name = meta.get('name', name)
                        quantity = meta.get('quantity', "") or ""
                    except json.JSONDecodeError:
                        pass
                ingredients_payload.append({
                    "name": name,
                    "quantity": quantity
                })

            recipe_data = {
                "title": recipe.title,
                "ingredients": ingredients_payload,
                "steps": LLMStepSerializer(steps_queryset, many=True).data
            }

            planned_recipe = clients.plan_recipe_for_voice(recipe_data)
        
        planned_steps = planned_recipe.get('planned_steps', [])
        opening_remark = planned_recipe.get('opening_remark')

        request.session['planned_recipe'] = planned_recipe

        current_step_index = -1
        session_step = -1
        if opening_remark:
            text_to_speak = opening_remark
        elif planned_steps:
            text_to_speak = planned_steps[0]['script']
            current_step_index = 0
            session_step = 0
        else:
            text_to_speak = "요리 정보가 없습니다."

        request.session['current_step'] = session_step

        return Response({
            'text': text_to_speak,
            'steps': [step['script'] for step in planned_recipe.get('planned_steps', [])],
            'current_step_index': current_step_index,
            'step_total': len(planned_steps),
            'is_step': current_step_index >= 0,
            'is_finished': len(planned_steps) == 0 and not opening_remark,
            'auto_continue': len(planned_steps) > 0,
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
            text_to_speak = planned_recipe.get('opening_remark', "요리를 시작합니다.")

        is_step = 0 <= current_step < len(steps)
        is_finished = current_step >= len(steps)

        return Response({
            'text': text_to_speak,
            'steps': [step['script'] for step in planned_recipe.get('planned_steps', [])],
            'current_step_index': current_step,
            'step_total': len(steps),
            'is_step': is_step,
            'is_finished': is_finished,
            'auto_continue': (is_step and not is_finished) or (current_step < 0 and len(steps) > 0),
        })


@method_decorator(csrf_exempt, name='dispatch')
class RealtimeSessionView(APIView):
    def post(self, request, *args, **kwargs):
        try:
            session_data = clients.create_realtime_session()
            token_value = session_data.get("value")
            session_config = session_data.get("session", {}) or {}
            session_payload = dict(session_config)
            session_payload.setdefault("type", "realtime")
            if token_value:
                session_payload["client_secret"] = token_value
            return Response({
                "session": session_payload,
                "model": session_payload.get("model", clients.OPENAI_REALTIME_MODEL),
            })
        except clients.APIClientError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
