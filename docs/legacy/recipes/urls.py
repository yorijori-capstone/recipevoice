from django.urls import path
from django.http import HttpResponse
from .views import (
    RecipeListView,
    RecipeDetailView,
    SearchView,
    VoiceControlView,
    LangchainAgentView,
    RealtimeSessionView,
    recipes_health_check,
)

app_name = 'recipes'

urlpatterns = [
    path('health_check/', recipes_health_check, name='recipes_health_check'), # Test route
    path('', RecipeListView.as_view(), name='recipe-list'),
    path('search/', SearchView.as_view(), name='recipe-search'),
    path('voice/control/', VoiceControlView.as_view(), name='voice-control'),
    path('voice/agent/', LangchainAgentView.as_view(), name='langchain-agent'),
    path('voice/realtime/session/', RealtimeSessionView.as_view(), name='voice-realtime-session'),
    path('<str:recipe_id>/', RecipeDetailView.as_view(), name='recipe-detail'),
]
