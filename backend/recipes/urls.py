from django.urls import path
from .views import RecipeListView, RecipeDetailView, SearchView, VoiceControlView, LangchainAgentView

app_name = 'recipes'

# Simple test view for debugging
def recipes_health_check(request):
    return HttpResponse("RECIPES_OK")

urlpatterns = [
    path('health_check/', recipes_health_check, name='recipes_health_check'), # Test route
    path('', RecipeListView.as_view(), name='recipe-list'),
    path('search/', SearchView.as_view(), name='recipe-search'),
    path('voice/control/', VoiceControlView.as_view(), name='voice-control'),
    path('voice/agent/', LangchainAgentView.as_view(), name='langchain-agent'),
    path('<str:recipe_id>/', RecipeDetailView.as_view(), name='recipe-detail'),
]