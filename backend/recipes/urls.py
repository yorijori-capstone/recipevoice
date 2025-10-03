from django.urls import path
from .views import RecipeListView, RecipeDetailView, SearchView, VoiceControlView

app_name = 'recipes'

urlpatterns = [
    path('', RecipeListView.as_view(), name='recipe-list'),
    path('search/', SearchView.as_view(), name='recipe-search'),
    path('voice/control/', VoiceControlView.as_view(), name='voice-control'),
    path('<str:source_id>/', RecipeDetailView.as_view(), name='recipe-detail'),
]