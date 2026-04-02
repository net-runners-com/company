"""Connector Plugin Loader — loads handler.py from R2 on demand."""

import json
import importlib.util
import os
import tempfile
from pathlib import Path
from typing import Optional, Type

from app.connector_base import ConnectorHandler
from app.r2 import _get_r2, R2_BUCKET, _env_prefix

PLUGINS_CACHE = Path("/tmp/connector-plugins")

_handler_cache: dict[str, Type[ConnectorHandler] | None] = {}


def _download_plugin_file(plugin_id: str, filename: str) -> bytes | None:
    """R2からプラグインファイルをダウンロード"""
    s3 = _get_r2()
    key = f"{_env_prefix()}plugins/{plugin_id}/{filename}"
    try:
        resp = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return resp["Body"].read()
    except Exception:
        return None


def get_handler_class(plugin_id: str) -> Optional[Type[ConnectorHandler]]:
    """プラグインのhandler classをR2から取得（キャッシュ付き）"""
    if plugin_id in _handler_cache:
        return _handler_cache[plugin_id]

    handler_py = _download_plugin_file(plugin_id, "handler.py")
    if not handler_py:
        _handler_cache[plugin_id] = None
        return None

    # ローカルにキャッシュしてimport
    cache_dir = PLUGINS_CACHE / plugin_id
    cache_dir.mkdir(parents=True, exist_ok=True)
    handler_path = cache_dir / "handler.py"
    handler_path.write_bytes(handler_py)

    try:
        spec = importlib.util.spec_from_file_location(f"connector_plugin_{plugin_id}", str(handler_path))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cls = getattr(module, "Handler", None)
        if cls and issubclass(cls, ConnectorHandler):
            _handler_cache[plugin_id] = cls
            return cls
    except Exception as e:
        print(f"[plugin] Failed to load handler for {plugin_id}: {e}")

    _handler_cache[plugin_id] = None
    return None


def clear_cache():
    """キャッシュをクリア（新しいプラグイン追加時に呼ぶ）"""
    _handler_cache.clear()


def load_all_plugins():
    """後方互換 — 起動時に呼ばれるが、R2方式では何もしない（オンデマンドロード）"""
    print("[plugin] R2-based plugin loader ready (on-demand)")
