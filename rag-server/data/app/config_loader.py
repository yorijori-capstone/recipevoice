"""Configuration loader."""
import yaml
from pathlib import Path
from typing import Any, Dict

def load_config(config_path: Path) -> Dict[str, Any]:
    """Load configuration from YAML file."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)