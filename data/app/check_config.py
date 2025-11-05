import os
import pprint

from data.app.config_loader import load_config

path = "config.yaml"
print("exists:", os.path.exists(path))
cfg = load_config(path)

pprint.pp(cfg)
print("\nembedding model:", cfg["embedding"]["model"])
print("dim:", cfg["embedding"]["dim"])
print("faiss_index_path:", cfg["paths"]["faiss_index_path"])
print("database:", cfg.get("database"))
