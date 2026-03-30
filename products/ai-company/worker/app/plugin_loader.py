"""
Connector Plugin Loader

Scans /workspace/data/connector-plugins/ for plugin directories,
loads manifest.json from each, and dynamically imports handler.py if present.
"""

import json
import importlib.util
from pathlib import Path
from typing import Optional, Type

from app.connector_base import ConnectorHandler

PLUGINS_DIR = Path("/workspace/data/connector-plugins")

_registry: dict[str, dict] = {}
# { plugin_id: { "manifest": dict, "handler_class": Type[ConnectorHandler] | None } }


def load_all_plugins() -> dict[str, dict]:
    """Scan plugin directories, load manifests and handler classes."""
    _registry.clear()

    if not PLUGINS_DIR.is_dir():
        return _registry

    for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir():
            continue

        manifest_path = plugin_dir / "manifest.json"
        if not manifest_path.exists():
            continue

        try:
            manifest = json.loads(manifest_path.read_text())
        except (json.JSONDecodeError, OSError):
            continue

        plugin_id = manifest.get("id", plugin_dir.name)
        handler_class = None

        handler_path = plugin_dir / "handler.py"
        if handler_path.exists():
            try:
                spec = importlib.util.spec_from_file_location(
                    f"connector_plugin_{plugin_id}", handler_path
                )
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                cls = getattr(module, "Handler", None)
                if cls and issubclass(cls, ConnectorHandler):
                    handler_class = cls
            except Exception:
                pass

        _registry[plugin_id] = {
            "manifest": manifest,
            "handler_class": handler_class,
        }

    return _registry


def get_registry() -> dict[str, dict]:
    """Return the current plugin registry."""
    return _registry


def get_all_manifests() -> list[dict]:
    """Return all loaded manifests."""
    return [entry["manifest"] for entry in _registry.values()]


def get_manifest(plugin_id: str) -> Optional[dict]:
    """Return manifest for a specific plugin."""
    entry = _registry.get(plugin_id)
    return entry["manifest"] if entry else None


def get_handler_class(plugin_id: str) -> Optional[Type[ConnectorHandler]]:
    """Return the handler class for a specific plugin, or None."""
    entry = _registry.get(plugin_id)
    return entry["handler_class"] if entry else None
