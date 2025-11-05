# data/app/config_loader.py
"""Utility helpers to load YAML configs with environment variable substitution."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

_ENV_PATTERN = re.compile(r"\$\{([^}]+)\}")


def _resolve_env(value: Any) -> Any:
    """Recursively replace ${VAR} placeholders with environment values."""
    if isinstance(value, dict):
        return {key: _resolve_env(sub_val) for key, sub_val in value.items()}
    if isinstance(value, list):
        return [_resolve_env(item) for item in value]
    if isinstance(value, str):
        return _replace_in_string(value)
    return value


def _replace_in_string(value: str) -> str:
    def _repl(match: re.Match[str]) -> str:
        var_name = match.group(1)
        env_value = os.getenv(var_name)
        if env_value is None:
            raise RuntimeError(
                f"Environment variable '{var_name}' referenced in config.yaml is not set"
            )
        return env_value

    return _ENV_PATTERN.sub(_repl, value)


def _fallback_load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return
    with dotenv_path.open("r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key:
                continue
            value = value.strip()
            if value.startswith(("'", '"')) and value.endswith(("'", '"')):
                value = value[1:-1]
            os.environ.setdefault(key, value)


def load_config(path: Path | str) -> dict[str, Any]:
    """Load YAML configuration file and resolve environment placeholders."""
    cfg_path = Path(path)
    if load_dotenv is not None:
        dotenv_path = cfg_path.parent / ".env"
        load_dotenv(dotenv_path, override=False)
    else:
        _fallback_load_dotenv(cfg_path.parent / ".env")
    with cfg_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return _resolve_env(data)


__all__ = ["load_config"]
