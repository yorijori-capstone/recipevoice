# backend/recipes/models.py
from django.db import models

class Recipe(models.Model):
    recipe_id = models.TextField(primary_key=True)
    title = models.TextField()
    source = models.TextField()
    external_id = models.TextField(blank=True, null=True)
    author = models.TextField(blank=True, null=True)
    servings = models.TextField(blank=True, null=True)
    total_time = models.TextField(blank=True, null=True)
    difficulty = models.TextField(blank=True, null=True)
    created_at = models.TextField(blank=True, null=True)
    updated_at = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'recipe'

class RecipeDoc(models.Model):
    recipe = models.OneToOneField(Recipe, on_delete=models.CASCADE, primary_key=True)
    source_url = models.TextField(blank=True, null=True)
    raw_json = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'recipe_doc'

class Step(models.Model):
    step_id = models.TextField(primary_key=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    step_no = models.IntegerField(blank=True, null=True)
    text = models.TextField()
    time_hint_sec = models.IntegerField(blank=True, null=True)
    tools_json = models.TextField(blank=True, null=True)
    warnings_json = models.TextField(blank=True, null=True)
    meta_json = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'step'

class Chunk(models.Model):
    chunk_id = models.TextField(primary_key=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    step = models.ForeignKey(Step, on_delete=models.SET_NULL, blank=True, null=True)
    step_no = models.IntegerField(blank=True, null=True)
    section = models.TextField(blank=True, null=True)
    text = models.TextField()
    meta_json = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'chunk'
        unique_together = (('recipe', 'step_no'),)

class ChunkEmbeddingMeta(models.Model):
    chunk = models.OneToOneField(Chunk, on_delete=models.CASCADE, primary_key=True)
    model_name = models.TextField()
    dim = models.IntegerField()
    created_at = models.TextField(blank=True, null=True)
    faiss_vector_id = models.IntegerField(unique=True)

    class Meta:
        managed = False
        db_table = 'chunk_embedding_meta'
