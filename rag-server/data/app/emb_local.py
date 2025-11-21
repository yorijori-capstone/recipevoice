"""Local embedding model wrapper."""
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List

class LocalEmbedder:
    """Local embedding model wrapper."""
    
    def __init__(self, model_name: str):
        print(f"📥 Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        print(f"✅ Model loaded successfully")
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """Encode texts to embeddings."""
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return embeddings