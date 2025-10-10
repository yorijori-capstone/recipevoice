from sentence_transformers import SentenceTransformer
import numpy as np

class LocalEmbedder:
    def __init__(self, model_name: str):
        self.model = SentenceTransformer(model_name)

    def encode(self, texts):
        # 2D float32 + L2 normalize (cosine == IP)
        embs = self.model.encode(texts, batch_size=64, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True)
        return embs.astype("float32")