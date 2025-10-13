import yaml, pprint, os

path = "config.yaml"
print("exists:", os.path.exists(path))
with open(path, "r", encoding="utf-8") as f:
    cfg = yaml.safe_load(f)

pprint.pp(cfg)
print("\nembedding model:", cfg["embedding"]["model"])
print("dim:", cfg["embedding"]["dim"])
print("sqlite_path:", cfg["paths"]["sqlite_path"])
print("faiss_index_path:", cfg["paths"]["faiss_index_path"])
