from __future__ import annotations

from datetime import datetime, timezone
import json
import time
import uuid

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings
from app.core.database import get_db
from app.core.secrets import SecretsManager
from app.schemas.platform import (
    CreateModelRequest,
    CreateProviderRequest,
    ModelResponse,
    ProviderResponse,
    ProviderSyncResponse,
    RoutingPolicyResponse,
    UpdateModelRequest,
    UpdateProviderRequest,
    UpdateRoutingPolicyRequest,
)
from app.services.provider_catalog_seed import SeedModel, model_seeds, provider_seeds


DEFAULT_PROVIDERS = [
    {
        "id": "mock",
        "name": "Mock Provider",
        "type": "mock",
        "base_url": "",
        "enabled": True,
        "visible_to_users": True,
        "status": "healthy",
        "description": "Local mock provider used for fallback and demos.",
    },
    {
        "id": "aliyun-bailian",
        "name": "阿里云百炼",
        "type": "qwen",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "enabled": True,
        "visible_to_users": True,
        "status": "healthy",
        "description": "阿里云百炼托管运行时，支持 Qwen 文本、视觉、全模态与向量模型。",
    },
]


DEFAULT_MODELS = [
    {
        "id": "aurora-mock-chat",
        "provider_id": "mock",
        "display_name": "Aurora Mock Chat",
        "internal_name": "aurora-mock-chat",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": 0.0,
        "output_price_per_1k": 0.0,
        "priority": 1,
        "tags": ["demo", "fallback"],
    },
    {
        "id": "aurora-mock-admin",
        "provider_id": "mock",
        "display_name": "Aurora Mock Admin",
        "internal_name": "aurora-mock-admin",
        "type": "chat",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": 0.0,
        "output_price_per_1k": 0.0,
        "priority": 0,
        "tags": ["demo", "admin"],
    },
    {
        "id": "qwen3-max",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 Max",
        "internal_name": "qwen3-max",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 98,
        "context_window": 258048,
        "tags": ["recommended", "quality", "reasoning"],
    },
    {
        "id": "qwen3-max-preview",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 Max Preview",
        "internal_name": "qwen3-max-preview",
        "type": "chat",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 97,
        "context_window": 81920,
        "tags": ["preview", "quality", "reasoning", "admin"],
    },
    {
        "id": "qwen3.6-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3.6 Plus",
        "internal_name": "qwen3.6-plus",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 96,
        "context_window": 1000000,
        "tags": ["recommended", "quality", "tool-use"],
    },
    {
        "id": "qwen3.6-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3.6 Flash",
        "internal_name": "qwen3.6-flash",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 92,
        "context_window": 1000000,
        "tags": ["fast", "tool-use"],
    },
    {
        "id": "qwen-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen Plus",
        "internal_name": "qwen-plus",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 88,
        "context_window": 997952,
        "tags": ["quality"],
    },
    {
        "id": "qwen-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen Flash",
        "internal_name": "qwen-flash",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 84,
        "context_window": 1000000,
        "tags": ["fast", "economy"],
    },
    {
        "id": "qwen-turbo",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen Turbo",
        "internal_name": "qwen-turbo",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 78,
        "context_window": 1000000,
        "tags": ["economy", "fast"],
    },
    {
        "id": "qwen-long",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen Long",
        "internal_name": "qwen-long",
        "type": "chat",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 72,
        "context_window": 1000000,
        "tags": ["long-context", "admin"],
    },
    {
        "id": "qwen3-coder-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 Coder Plus",
        "internal_name": "qwen3-coder-plus",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 94,
        "context_window": 1000000,
        "tags": ["code", "quality", "recommended"],
    },
    {
        "id": "qwen3-coder-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 Coder Flash",
        "internal_name": "qwen3-coder-flash",
        "type": "chat",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 89,
        "context_window": 1000000,
        "tags": ["code", "fast"],
    },
    {
        "id": "qwq-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "QwQ Plus",
        "internal_name": "qwq-plus",
        "type": "chat",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 86,
        "context_window": 131072,
        "tags": ["reasoning", "admin"],
    },
    {
        "id": "qwen3-vl-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 VL Plus",
        "internal_name": "qwen3-vl-plus",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": True,
        "is_default_for_admin": True,
        "input_price_per_1k": 0.0022,
        "output_price_per_1k": 0.0068,
        "priority": 90,
        "context_window": 128000,
        "tags": ["recommended", "quality", "vision"],
    },
    {
        "id": "qwen3-vl-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 VL Flash",
        "internal_name": "qwen3-vl-flash",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 87,
        "context_window": 128000,
        "tags": ["vision", "fast"],
    },
    {
        "id": "qwen-vl-max-latest",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen VL Max Latest",
        "internal_name": "qwen-vl-max-latest",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": 0.0035,
        "output_price_per_1k": 0.0102,
        "priority": 95,
        "context_window": 128000,
        "tags": ["quality", "vision", "high-cost"],
    },
    {
        "id": "qwen2.5-vl-72b-instruct",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen2.5 VL 72B",
        "internal_name": "qwen2.5-vl-72b-instruct",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": 0.0028,
        "output_price_per_1k": 0.0086,
        "priority": 80,
        "context_window": 128000,
        "tags": ["vision"],
    },
    {
        "id": "qwen2.5-vl-32b-instruct",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen2.5 VL 32B",
        "internal_name": "qwen2.5-vl-32b-instruct",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 79,
        "context_window": 128000,
        "tags": ["vision"],
    },
    {
        "id": "qwen2.5-vl-7b-instruct",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen2.5 VL 7B",
        "internal_name": "qwen2.5-vl-7b-instruct",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": True,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 77,
        "context_window": 128000,
        "tags": ["vision", "economy"],
    },
    {
        "id": "qwen2.5-vl-3b-instruct",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen2.5 VL 3B",
        "internal_name": "qwen2.5-vl-3b-instruct",
        "type": "vision",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 70,
        "context_window": 128000,
        "tags": ["vision", "economy", "admin"],
    },
    {
        "id": "qwen-vl-ocr",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen OCR",
        "internal_name": "qwen-vl-ocr",
        "type": "vision",
        "enabled": True,
        "visible_to_users": True,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 76,
        "context_window": 8192,
        "tags": ["ocr", "vision", "document"],
    },
    {
        "id": "qwen-vl-ocr-latest",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen OCR Latest",
        "internal_name": "qwen-vl-ocr-latest",
        "type": "vision",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 75,
        "context_window": 8192,
        "tags": ["ocr", "vision", "latest", "admin"],
    },
    {
        "id": "qwen3.5-omni-plus",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3.5 Omni Plus",
        "internal_name": "qwen3.5-omni-plus",
        "type": "audio",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 85,
        "context_window": 128000,
        "tags": ["omni", "audio", "vision", "admin"],
    },
    {
        "id": "qwen3.5-omni-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3.5 Omni Flash",
        "internal_name": "qwen3.5-omni-flash",
        "type": "audio",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 83,
        "context_window": 128000,
        "tags": ["omni", "audio", "fast", "admin"],
    },
    {
        "id": "qwen3-omni-flash",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 Omni Flash",
        "internal_name": "qwen3-omni-flash",
        "type": "audio",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 82,
        "context_window": 128000,
        "tags": ["omni", "audio", "reasoning", "admin"],
    },
    {
        "id": "qwen-omni-turbo",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen Omni Turbo",
        "internal_name": "qwen-omni-turbo",
        "type": "audio",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 68,
        "context_window": 32768,
        "tags": ["omni", "legacy", "audio", "admin"],
    },
    {
        "id": "text-embedding-v4",
        "provider_id": "aliyun-bailian",
        "display_name": "Text Embedding V4",
        "internal_name": "text-embedding-v4",
        "type": "embedding",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 74,
        "context_window": 8192,
        "tags": ["embedding", "recommended"],
    },
    {
        "id": "text-embedding-v3",
        "provider_id": "aliyun-bailian",
        "display_name": "Text Embedding V3",
        "internal_name": "text-embedding-v3",
        "type": "embedding",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 69,
        "context_window": 8192,
        "tags": ["embedding"],
    },
    {
        "id": "qwen3-vl-embedding",
        "provider_id": "aliyun-bailian",
        "display_name": "Qwen3 VL Embedding",
        "internal_name": "qwen3-vl-embedding",
        "type": "embedding",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 73,
        "context_window": 8192,
        "tags": ["embedding", "vision"],
    },
    {
        "id": "multimodal-embedding-v1",
        "provider_id": "aliyun-bailian",
        "display_name": "Multimodal Embedding V1",
        "internal_name": "multimodal-embedding-v1",
        "type": "embedding",
        "enabled": True,
        "visible_to_users": False,
        "allow_auto_select": False,
        "is_default_for_user": False,
        "is_default_for_admin": False,
        "input_price_per_1k": None,
        "output_price_per_1k": None,
        "priority": 67,
        "context_window": 4096,
        "tags": ["embedding", "multimodal"],
    },
]


class ProviderRegistryService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.secrets = SecretsManager(settings)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _loads_json(value: str | None, fallback):
        if not value:
            return fallback
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback

    @staticmethod
    def _display_name_from_model_id(model_id: str) -> str:
        return " ".join(part.capitalize() for part in model_id.replace("_", "-").split("-") if part)

    @staticmethod
    def _infer_model_type(model_id: str) -> str:
        lowered = model_id.lower()
        if any(token in lowered for token in ("embed", "embedding")):
            return "embedding"
        if any(token in lowered for token in ("image", "wanx", "dall-e", "flux")):
            return "image"
        if any(token in lowered for token in ("audio", "tts", "whisper")):
            return "audio"
        if any(token in lowered for token in ("vision", "vl", "omni")):
            return "vision"
        return "chat"

    @staticmethod
    def _model_tags(model_id: str, model_type: str) -> list[str]:
        lowered = model_id.lower()
        tags: list[str] = []
        if any(token in lowered for token in ("max", "plus", "pro")):
            tags.append("quality")
        if any(token in lowered for token in ("flash", "turbo", "mini", "fast")):
            tags.append("fast")
        if any(token in lowered for token in ("reason", "qwq", "o1", "o3", "o4")):
            tags.append("reasoning")
        if model_type != "chat":
            tags.append(model_type)
        return tags

    @staticmethod
    def _model_description(model_id: str, model_type: str, tags: list[str]) -> str:
        traits: list[str] = []
        if "quality" in tags:
            traits.append("quality-focused")
        if "fast" in tags:
            traits.append("low-latency")
        if "reasoning" in tags:
            traits.append("reasoning")
        if model_type == "vision":
            traits.append("vision-capable")
        if model_type == "embedding":
            traits.append("embedding")
        if model_type == "image":
            traits.append("image generation")
        suffix = ", ".join(traits) if traits else "general chat"
        return f"{model_id} is a {suffix} model synced from the provider catalog."

    @staticmethod
    def _seed_source(model: SeedModel) -> str:
        if "official_api" in model.tags:
            return "official_api"
        if "official_docs_seed" in model.tags:
            return "official_docs_seed"
        return "curated_seed"

    def _provider_row_to_response(self, row) -> ProviderResponse:
        return ProviderResponse(
            id=row["id"],
            name=row["name"],
            type=row["type"],
            base_url=row["base_url"],
            api_key_masked=row["api_key_masked"],
            enabled=bool(row["enabled"]),
            visible_to_users=bool(row["visible_to_users"]),
            status=row["status"],
            description=row["description"],
            last_checked_at=row["last_checked_at"],
            last_synced_at=row["last_synced_at"],
            sync_status=row["sync_status"],
            sync_error=row["sync_error"],
            external_quota=self._loads_json(row["external_quota_json"], None),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _model_row_to_response(self, row) -> ModelResponse:
        metadata = self._loads_json(row["metadata_json"], {})
        return ModelResponse(
            id=row["id"],
            provider_id=row["provider_id"],
            display_name=row["display_name"],
            internal_name=row["internal_name"],
            type=row["type"],
            enabled=bool(row["enabled"]),
            visible_to_users=bool(row["visible_to_users"]),
            allow_auto_select=bool(row["allow_auto_select"]),
            is_default_for_user=bool(row["is_default_for_user"]),
            is_default_for_admin=bool(row["is_default_for_admin"]),
            input_price_per_1k=row["input_price_per_1k"],
            output_price_per_1k=row["output_price_per_1k"],
            image_price_per_call=row["image_price_per_call"],
            priority=row["priority"],
            context_window=row["context_window"],
            tags=self._loads_json(row["tags"], []),
            metadata_json=metadata,
            description=metadata.get("description") if isinstance(metadata, dict) else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def ensure_seed_data(self) -> None:
        now = self._now()
        encrypted_key = self.secrets.encrypt(self.settings.api_key) if self.settings.api_key else None
        with get_db() as connection:
            for provider in DEFAULT_PROVIDERS:
                api_key_encrypted = (
                    encrypted_key if provider["id"] == "aliyun-bailian" and encrypted_key else None
                )
                api_key_masked = (
                    self.secrets.mask(self.settings.api_key)
                    if provider["id"] == "aliyun-bailian" and self.settings.api_key
                    else None
                )
                connection.execute(
                    """
                    INSERT OR IGNORE INTO providers (
                        id, name, type, base_url, api_key_encrypted, api_key_masked, enabled,
                        visible_to_users, status, description, last_checked_at, created_at, updated_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                    """,
                    (
                        provider["id"],
                        provider["name"],
                        provider["type"],
                        self.settings.base_url if provider["id"] == "aliyun-bailian" else provider["base_url"],
                        api_key_encrypted,
                        api_key_masked,
                        1 if provider["enabled"] else 0,
                        1 if provider["visible_to_users"] else 0,
                        provider["status"] if provider["id"] == "mock" or self.settings.api_key else "unknown",
                        provider["description"],
                        now,
                        now,
                    ),
                )

                if provider["id"] in {"mock", "aliyun-bailian"}:
                    connection.execute(
                        """
                        UPDATE providers
                        SET name = ?, description = ?, updated_at = ?
                        WHERE id = ? AND deleted_at IS NULL
                        """,
                        (provider["name"], provider["description"], now, provider["id"]),
                    )

            for provider in provider_seeds():
                connection.execute(
                    """
                    INSERT OR IGNORE INTO providers (
                        id, name, type, base_url, api_key_encrypted, api_key_masked, enabled,
                        visible_to_users, status, description, last_checked_at, created_at, updated_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, 'unknown', ?, NULL, ?, ?, NULL)
                    """,
                    (
                        provider.id,
                        provider.name,
                        provider.type,
                        provider.base_url,
                        provider.description,
                        now,
                        now,
                    ),
                )

            legacy_runtime_rows = connection.execute(
                """
                SELECT provider_id, base_url, configured_model, api_key_encrypted, updated_at
                FROM provider_runtime_configs
                """
            ).fetchall()
            for row in legacy_runtime_rows:
                provider_id = row["provider_id"]
                mapped_provider_id = "aliyun-bailian" if provider_id == "openai-compatible" else provider_id
                provider = connection.execute(
                    """
                    SELECT id, api_key_encrypted, base_url
                    FROM providers
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (mapped_provider_id,),
                ).fetchone()
                if provider is None:
                    continue
                should_copy_key = bool(row["api_key_encrypted"]) and not provider["api_key_encrypted"]
                should_copy_base_url = bool(row["base_url"]) and (
                    not provider["base_url"] or provider["base_url"] == ""
                )
                if should_copy_key or should_copy_base_url:
                    decrypted = (
                        self.secrets.decrypt(row["api_key_encrypted"]) if row["api_key_encrypted"] else None
                    )
                    connection.execute(
                        """
                        UPDATE providers
                        SET api_key_encrypted = COALESCE(?, api_key_encrypted),
                            api_key_masked = COALESCE(?, api_key_masked),
                            base_url = CASE WHEN base_url = '' OR base_url IS NULL THEN COALESCE(?, base_url) ELSE base_url END,
                            status = CASE WHEN ? IS NOT NULL THEN 'healthy' ELSE status END,
                            updated_at = ?
                        WHERE id = ? AND deleted_at IS NULL
                        """,
                        (
                            row["api_key_encrypted"] if should_copy_key else None,
                            self.secrets.mask(decrypted) if should_copy_key else None,
                            row["base_url"] if should_copy_base_url else None,
                            row["api_key_encrypted"] if should_copy_key else None,
                            now,
                            mapped_provider_id,
                        ),
                    )

            # Activate the AI provider configured via .env settings
            configured_provider = self.settings.provider
            if configured_provider and configured_provider != "mock" and encrypted_key:
                connection.execute(
                    """
                    UPDATE providers
                    SET api_key_encrypted = ?, api_key_masked = ?,
                        base_url = ?,
                        enabled = 1, visible_to_users = 1,
                        status = 'healthy', updated_at = ?
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (
                        encrypted_key,
                        self.secrets.mask(self.settings.api_key),
                        self.settings.base_url,
                        now,
                        configured_provider,
                    ),
                )
                connection.execute(
                    """
                    UPDATE models
                    SET enabled = 1, visible_to_users = 1, updated_at = ?
                    WHERE provider_id = ? AND deleted_at IS NULL
                    """,
                    (now, configured_provider),
                )

            for model in DEFAULT_MODELS:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO models (
                        id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                        allow_auto_select, is_default_for_user, is_default_for_admin,
                        input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                        context_window, tags, metadata_json, created_at, updated_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        model["id"],
                        model["provider_id"],
                        model["display_name"],
                        model["internal_name"],
                        model["type"],
                        1 if model["enabled"] else 0,
                        1 if model["visible_to_users"] else 0,
                        1 if model["allow_auto_select"] else 0,
                        1 if model["is_default_for_user"] else 0,
                        1 if model["is_default_for_admin"] else 0,
                        model.get("input_price_per_1k"),
                        model.get("output_price_per_1k"),
                        model["priority"],
                        model.get("context_window"),
                        json.dumps(model.get("tags", []), ensure_ascii=False),
                        json.dumps({}, ensure_ascii=False),
                        now,
                        now,
                    ),
                )

            for provider in provider_seeds():
                for model in model_seeds(provider.id, provider.type):
                    metadata = {
                        "source": self._seed_source(model),
                        "catalog_vendor": provider.id,
                        "official_id": model.internal_name or model.id,
                        "description": self._model_description(model.id, model.type, list(model.tags)),
                    }
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO models (
                            id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                            allow_auto_select, is_default_for_user, is_default_for_admin,
                            input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                            context_window, tags, metadata_json, created_at, updated_at, deleted_at
                        )
                        VALUES (?, ?, ?, ?, ?, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, ?, ?, ?, ?, ?, NULL)
                        """,
                        (
                            model.internal_name or model.id,
                            provider.id,
                            model.display_name,
                            model.id,
                            model.type,
                            model.context_window,
                            json.dumps(list(model.tags), ensure_ascii=False),
                            json.dumps(metadata, ensure_ascii=False),
                            now,
                            now,
                        ),
                    )

            existing_policy = connection.execute("SELECT id FROM routing_policies WHERE id = 1").fetchone()
            if existing_policy is None:
                connection.execute(
                    """
                    INSERT INTO routing_policies (
                        id, default_user_model_id, default_admin_model_id,
                        allow_user_model_switching, allow_auto_model_selection,
                        auto_model_strategy_default, fallback_enabled, created_at, updated_at
                    )
                    VALUES (1, ?, ?, 1, 1, 'high_quality', 1, ?, ?)
                    """,
                    (self.settings.model, self.settings.model, now, now),
                )
            else:
                connection.execute(
                    """
                    UPDATE routing_policies
                    SET default_user_model_id = ?,
                        default_admin_model_id = ?,
                        updated_at = ?
                    WHERE id = 1
                    """,
                    (self.settings.model, self.settings.model, now),
                )

    def list_providers(self, *, include_disabled: bool = True) -> list[ProviderResponse]:
        query = """
            SELECT id, name, type, base_url, api_key_masked, enabled, visible_to_users,
                   status, description, last_checked_at, last_synced_at, sync_status,
                   sync_error, external_quota_json, created_at, updated_at
            FROM providers
            WHERE deleted_at IS NULL
        """
        if not include_disabled:
            query += " AND enabled = 1"
        query += " ORDER BY name ASC"
        with get_db() as connection:
            rows = connection.execute(query).fetchall()
        return [self._provider_row_to_response(row) for row in rows]

    def get_provider(self, provider_id: str) -> ProviderResponse | None:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, name, type, base_url, api_key_masked, enabled, visible_to_users,
                       status, description, last_checked_at, last_synced_at, sync_status,
                       sync_error, external_quota_json, created_at, updated_at
                FROM providers
                WHERE id = ? AND deleted_at IS NULL
                """,
                (provider_id,),
            ).fetchone()
        return self._provider_row_to_response(row) if row else None

    def list_provider_health_checks(self, provider_id: str, *, limit: int = 30) -> list[dict]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, provider_id, status, latency_ms, checked_at, detail_json
                FROM provider_health_checks
                WHERE provider_id = ?
                ORDER BY datetime(checked_at) DESC
                LIMIT ?
                """,
                (provider_id, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_provider_runtime(self, provider_id: str) -> dict | None:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, name, type, base_url, api_key_encrypted, api_key_masked, enabled,
                       visible_to_users, status, description, last_checked_at, last_synced_at,
                       sync_status, sync_error, external_quota_json, created_at, updated_at
                FROM providers
                WHERE id = ? AND deleted_at IS NULL
                """,
                (provider_id,),
            ).fetchone()
        if row is None:
            return None
        api_key = self.secrets.decrypt(row["api_key_encrypted"]) if row["api_key_encrypted"] else None
        if not api_key:
            legacy_ids = [provider_id]
            if provider_id == "aliyun-bailian":
                legacy_ids.append("openai-compatible")
            with get_db() as connection:
                placeholders = ",".join("?" for _ in legacy_ids)
                legacy_row = connection.execute(
                    f"""
                    SELECT provider_id, base_url, api_key_encrypted
                    FROM provider_runtime_configs
                    WHERE provider_id IN ({placeholders})
                    ORDER BY CASE WHEN provider_id = 'aliyun-bailian' THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    tuple(legacy_ids),
                ).fetchone()
            if legacy_row and legacy_row["api_key_encrypted"]:
                api_key = self.secrets.decrypt(legacy_row["api_key_encrypted"])
                with get_db() as connection:
                    connection.execute(
                        """
                        UPDATE providers
                        SET api_key_encrypted = ?, api_key_masked = ?, base_url = ?, status = ?, updated_at = ?
                        WHERE id = ? AND deleted_at IS NULL
                        """,
                        (
                            legacy_row["api_key_encrypted"],
                            self.secrets.mask(api_key),
                            legacy_row["base_url"] or row["base_url"],
                            "healthy",
                            self._now(),
                            provider_id,
                        ),
                    )
                row = {
                    **dict(row),
                    "base_url": legacy_row["base_url"] or row["base_url"],
                    "api_key_masked": self.secrets.mask(api_key),
                    "status": "healthy",
                }
        return {
            "id": row["id"],
            "name": row["name"],
            "type": row["type"],
            "base_url": row["base_url"],
            "api_key": api_key,
            "api_key_masked": row["api_key_masked"],
            "enabled": bool(row["enabled"]),
            "visible_to_users": bool(row["visible_to_users"]),
            "status": row["status"],
            "description": row["description"],
            "last_checked_at": row["last_checked_at"],
            "last_synced_at": row["last_synced_at"],
            "sync_status": row["sync_status"],
            "sync_error": row["sync_error"],
            "external_quota_json": row["external_quota_json"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def create_provider(self, payload: CreateProviderRequest) -> ProviderResponse:
        now = self._now()
        encrypted_key = self.secrets.encrypt(payload.api_key) if payload.api_key else None
        masked_key = self.secrets.mask(payload.api_key) if payload.api_key else None
        with get_db() as connection:
            existing = connection.execute(
                "SELECT id FROM providers WHERE id = ? AND deleted_at IS NULL",
                (payload.id,),
            ).fetchone()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Provider already exists.")
            connection.execute(
                """
                INSERT INTO providers (
                    id, name, type, base_url, api_key_encrypted, api_key_masked, enabled,
                    visible_to_users, status, description, last_checked_at, created_at, updated_at, deleted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                """,
                (
                    payload.id,
                    payload.name,
                    payload.type,
                    payload.base_url,
                    encrypted_key,
                    masked_key,
                    1 if payload.enabled else 0,
                    1 if payload.visible_to_users else 0,
                    "unknown" if payload.type != "mock" else "healthy",
                    payload.description,
                    now,
                    now,
                ),
            )
        return self.get_provider(payload.id)  # type: ignore[return-value]

    def update_provider(self, provider_id: str, payload: UpdateProviderRequest) -> ProviderResponse | None:
        runtime = self.get_provider_runtime(provider_id)
        if runtime is None:
            return None
        patch = payload.model_dump(exclude_unset=True)
        with get_db() as connection:
            current_row = connection.execute(
                "SELECT api_key_encrypted FROM providers WHERE id = ? AND deleted_at IS NULL",
                (provider_id,),
            ).fetchone()
        api_key_encrypted = current_row["api_key_encrypted"] if current_row else None
        if patch.get("api_key"):
            api_key_encrypted = self.secrets.encrypt(patch["api_key"])
        if patch.get("clear_api_key"):
            api_key_encrypted = None
        api_key_masked = self.secrets.mask(patch["api_key"]) if patch.get("api_key") else runtime["api_key_masked"]
        if patch.get("clear_api_key"):
            api_key_masked = None
        now = self._now()
        with get_db() as connection:
            connection.execute(
                """
                UPDATE providers
                SET name = ?, type = ?, base_url = ?, api_key_encrypted = ?, api_key_masked = ?,
                    enabled = ?, visible_to_users = ?, status = ?, description = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (
                    patch.get("name", runtime["name"]),
                    patch.get("type", runtime["type"]),
                    patch.get("base_url", runtime["base_url"]),
                    api_key_encrypted,
                    api_key_masked,
                    1 if patch.get("enabled", runtime["enabled"]) else 0,
                    1 if patch.get("visible_to_users", runtime["visible_to_users"]) else 0,
                    patch.get("status", runtime["status"]),
                    patch.get("description", runtime["description"]),
                    now,
                    provider_id,
                ),
            )
        return self.get_provider(provider_id)

    def _record_provider_sync(
        self,
        provider_id: str,
        *,
        status_value: str,
        error: str | None,
        quota: dict | None,
        synced_at: str,
    ) -> None:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE providers
                SET last_synced_at = ?, sync_status = ?, sync_error = ?,
                    external_quota_json = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (
                    synced_at,
                    status_value,
                    error,
                    json.dumps(quota, ensure_ascii=False) if quota else None,
                    synced_at,
                    provider_id,
                ),
            )

    def _seed_raw_models(self, runtime: dict, synced_at: str) -> list[dict]:
        seeds = model_seeds(runtime["id"], runtime.get("type"))
        return [
            {
                "id": seed.id,
                "internal_name": seed.internal_name or seed.id,
                "display_name": seed.display_name,
                "type": seed.type,
                "context_window": seed.context_window,
                "tags": list(seed.tags),
                "source": self._seed_source(seed),
                "catalog_vendor": runtime["id"],
                "owned_by": runtime["id"],
                "synced_at": synced_at,
            }
            for seed in seeds
        ]

    async def sync_provider_catalog(
        self,
        provider_id: str,
        *,
        include_models: bool = True,
        include_quota: bool = True,
    ) -> ProviderSyncResponse | None:
        runtime = self.get_provider_runtime(provider_id)
        if runtime is None:
            return None
        synced_at = self._now()
        quota = (
            {
                "status": "unsupported",
                "detail": "This provider does not expose a supported quota API.",
            }
            if include_quota
            else None
        )
        if not include_models:
            self._record_provider_sync(
                provider_id,
                status_value="success",
                error=None,
                quota=quota,
                synced_at=synced_at,
            )
            provider = self.get_provider(provider_id)
            return ProviderSyncResponse(
                provider=provider,  # type: ignore[arg-type]
                status="success",
                detail="Provider metadata refreshed.",
                quota_status=quota["status"] if quota else "skipped",
                quota=quota,
                synced_at=synced_at,
            )
        if runtime["type"] == "mock":
            self._record_provider_sync(
                provider_id,
                status_value="success",
                error=None,
                quota=quota,
                synced_at=synced_at,
            )
            provider = self.get_provider(provider_id)
            return ProviderSyncResponse(
                provider=provider,  # type: ignore[arg-type]
                status="success",
                detail="Mock provider has no remote model catalog.",
                quota_status=quota["status"] if quota else "skipped",
                quota=quota,
                synced_at=synced_at,
            )
        raw_models: list = []
        sync_source = "official_api"
        sync_warning: str | None = None
        seed_models = self._seed_raw_models(runtime, synced_at)
        if not runtime["base_url"] or not runtime["api_key"]:
            raw_models = seed_models
            sync_source = "seed"
            sync_warning = "Missing base URL or API key; refreshed built-in catalog seed instead."
        else:
            endpoint = f"{runtime['base_url'].rstrip('/')}/models"
            try:
                async with httpx.AsyncClient(timeout=self.settings.request_timeout) as client:
                    response = await client.get(
                        endpoint,
                        headers={"Authorization": f"Bearer {runtime['api_key']}"},
                    )
                response.raise_for_status()
                payload = response.json()
                remote_models = payload.get("data") if isinstance(payload, dict) else None
                if not isinstance(remote_models, list):
                    raise ValueError("Provider did not return an OpenAI-compatible model list.")
                seen_ids = {
                    str(item.get("id") if isinstance(item, dict) else item).strip()
                    for item in remote_models
                }
                raw_models = [
                    *(item for item in remote_models if str(item.get("id") if isinstance(item, dict) else item).strip()),
                    *(item for item in seed_models if item["id"] not in seen_ids),
                ]
            except Exception as exc:  # noqa: BLE001
                raw_models = seed_models
                sync_source = "seed"
                sync_warning = f"Official catalog sync failed; refreshed built-in seed instead: {exc}"
        if not raw_models:
            detail = sync_warning or "Provider did not expose models and no seed catalog is available."
            self._record_provider_sync(
                provider_id,
                status_value="error",
                error=detail,
                quota=quota,
                synced_at=synced_at,
            )
            provider = self.get_provider(provider_id)
            return ProviderSyncResponse(
                provider=provider,  # type: ignore[arg-type]
                status="error",
                detail=detail,
                quota_status=quota["status"] if quota else "skipped",
                quota=quota,
                synced_at=synced_at,
            )

        created_count = 0
        updated_count = 0
        with get_db() as connection:
            for item in raw_models:
                model_id = str(item.get("id") if isinstance(item, dict) else item).strip()
                if not model_id:
                    continue
                model_type = (
                    str(item.get("type")).strip()
                    if isinstance(item, dict) and item.get("type")
                    else self._infer_model_type(model_id)
                )
                tags = (
                    list(item.get("tags", []))
                    if isinstance(item, dict) and isinstance(item.get("tags"), list)
                    else self._model_tags(model_id, model_type)
                )
                source = (
                    str(item.get("source"))
                    if isinstance(item, dict) and item.get("source")
                    else "official_api"
                )
                metadata = {
                    "source": source,
                    "catalog_vendor": provider_id,
                    "official_id": model_id,
                    "owned_by": item.get("owned_by") if isinstance(item, dict) else None,
                    "description": self._model_description(model_id, model_type, tags),
                    "last_synced_at": synced_at,
                    "raw": item if isinstance(item, dict) else {"id": model_id},
                }
                existing = connection.execute(
                    "SELECT id, metadata_json FROM models WHERE id = ? AND deleted_at IS NULL",
                    (model_id,),
                ).fetchone()
                if existing:
                    current_metadata = self._loads_json(existing["metadata_json"], {})
                    if not isinstance(current_metadata, dict):
                        current_metadata = {}
                    current_metadata.update(metadata)
                    connection.execute(
                        """
                        UPDATE models
                        SET metadata_json = ?, updated_at = ?
                        WHERE id = ? AND deleted_at IS NULL
                        """,
                        (json.dumps(current_metadata, ensure_ascii=False), synced_at, model_id),
                    )
                    updated_count += 1
                    continue
                connection.execute(
                    """
                    INSERT INTO models (
                        id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                        allow_auto_select, is_default_for_user, is_default_for_admin,
                        input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                        context_window, tags, metadata_json, created_at, updated_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, ?, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        str(item.get("internal_name")) if isinstance(item, dict) and item.get("internal_name") else model_id,
                        provider_id,
                        str(item.get("display_name")) if isinstance(item, dict) and item.get("display_name") else self._display_name_from_model_id(model_id),
                        model_id,
                        model_type,
                        item.get("context_window") if isinstance(item, dict) else None,
                        json.dumps(tags, ensure_ascii=False),
                        json.dumps(metadata, ensure_ascii=False),
                        synced_at,
                        synced_at,
                    ),
                )
                created_count += 1

        self._record_provider_sync(
            provider_id,
            status_value="warning" if sync_warning else "success",
            error=sync_warning,
            quota=quota,
            synced_at=synced_at,
        )
        provider = self.get_provider(provider_id)
        return ProviderSyncResponse(
            provider=provider,  # type: ignore[arg-type]
            status="warning" if sync_warning else "success",
            detail=sync_warning or f"Synced {created_count + updated_count} models from {sync_source} catalog.",
            model_count=created_count + updated_count,
            created_count=created_count,
            updated_count=updated_count,
            quota_status=quota["status"] if quota else "skipped",
            quota=quota,
            synced_at=synced_at,
        )

    def delete_provider(self, provider_id: str) -> bool:
        with get_db() as connection:
            model_rows = connection.execute(
                "SELECT id FROM models WHERE provider_id = ? AND deleted_at IS NULL",
                (provider_id,),
            ).fetchall()
            model_ids = [row["id"] for row in model_rows]
            cursor = connection.execute(
                "UPDATE providers SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                (self._now(), self._now(), provider_id),
            )
            deleted = cursor.rowcount > 0
            if deleted:
                now = self._now()
                connection.execute(
                    "UPDATE models SET deleted_at = ?, updated_at = ? WHERE provider_id = ? AND deleted_at IS NULL",
                    (now, now, provider_id),
                )
                if model_ids:
                    placeholders = ",".join("?" for _ in model_ids)
                    connection.execute(
                        f"DELETE FROM model_fallbacks WHERE source_model_id IN ({placeholders}) OR fallback_model_id IN ({placeholders})",
                        tuple(model_ids + model_ids),
                    )
                self._repair_routing_after_delete(connection, set(model_ids))
            return deleted

    def _repair_routing_after_delete(self, connection, deleted_model_ids: set[str]) -> None:
        if not deleted_model_ids:
            return
        replacement = connection.execute(
            """
            SELECT id
            FROM models
            WHERE deleted_at IS NULL AND enabled = 1
            ORDER BY priority DESC, display_name ASC
            LIMIT 1
            """
        ).fetchone()
        replacement_id = replacement["id"] if replacement else None
        routing = connection.execute(
            "SELECT default_user_model_id, default_admin_model_id FROM routing_policies WHERE id = 1"
        ).fetchone()
        if not routing:
            return
        user_model = routing["default_user_model_id"]
        admin_model = routing["default_admin_model_id"]
        connection.execute(
            """
            UPDATE routing_policies
            SET default_user_model_id = ?, default_admin_model_id = ?, updated_at = ?
            WHERE id = 1
            """,
            (
                replacement_id if user_model in deleted_model_ids else user_model,
                replacement_id if admin_model in deleted_model_ids else admin_model,
                self._now(),
            ),
        )

    def list_models(self, *, provider_id: str | None = None, include_disabled: bool = True) -> list[ModelResponse]:
        query = """
            SELECT id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                   allow_auto_select, is_default_for_user, is_default_for_admin,
                   input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                   context_window, tags, metadata_json, created_at, updated_at
            FROM models
            WHERE deleted_at IS NULL
        """
        params: list[str] = []
        if provider_id:
            query += " AND provider_id = ?"
            params.append(provider_id)
        if not include_disabled:
            query += " AND enabled = 1"
        query += " ORDER BY priority DESC, display_name ASC"
        with get_db() as connection:
            rows = connection.execute(query, tuple(params)).fetchall()
        return [self._model_row_to_response(row) for row in rows]

    def get_model(self, model_id: str) -> ModelResponse | None:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                       allow_auto_select, is_default_for_user, is_default_for_admin,
                       input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                       context_window, tags, metadata_json, created_at, updated_at
                FROM models
                WHERE id = ? AND deleted_at IS NULL
                """,
                (model_id,),
            ).fetchone()
        return self._model_row_to_response(row) if row else None

    def create_model(self, payload: CreateModelRequest) -> ModelResponse:
        now = self._now()
        with get_db() as connection:
            provider = connection.execute(
                "SELECT id FROM providers WHERE id = ? AND deleted_at IS NULL",
                (payload.provider_id,),
            ).fetchone()
            if provider is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
            existing = connection.execute(
                "SELECT id FROM models WHERE id = ? AND deleted_at IS NULL",
                (payload.id,),
            ).fetchone()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Model already exists.")
            connection.execute(
                """
                INSERT INTO models (
                    id, provider_id, display_name, internal_name, type, enabled, visible_to_users,
                    allow_auto_select, is_default_for_user, is_default_for_admin,
                    input_price_per_1k, output_price_per_1k, image_price_per_call, priority,
                    context_window, tags, metadata_json, created_at, updated_at, deleted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    payload.id,
                    payload.provider_id,
                    payload.display_name,
                    payload.internal_name,
                    payload.type,
                    1 if payload.enabled else 0,
                    1 if payload.visible_to_users else 0,
                    1 if payload.allow_auto_select else 0,
                    1 if payload.is_default_for_user else 0,
                    1 if payload.is_default_for_admin else 0,
                    payload.input_price_per_1k,
                    payload.output_price_per_1k,
                    payload.image_price_per_call,
                    payload.priority,
                    payload.context_window,
                    json.dumps(payload.tags, ensure_ascii=False),
                    json.dumps(payload.metadata_json, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        return self.get_model(payload.id)  # type: ignore[return-value]

    def update_model(self, model_id: str, payload: UpdateModelRequest) -> ModelResponse | None:
        current = self.get_model(model_id)
        if current is None:
            return None
        patch = payload.model_dump(exclude_unset=True)
        now = self._now()
        with get_db() as connection:
            connection.execute(
                """
                UPDATE models
                SET display_name = ?, internal_name = ?, type = ?, enabled = ?, visible_to_users = ?,
                    allow_auto_select = ?, is_default_for_user = ?, is_default_for_admin = ?,
                    input_price_per_1k = ?, output_price_per_1k = ?, image_price_per_call = ?,
                    priority = ?, context_window = ?, tags = ?, metadata_json = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (
                    patch.get("display_name", current.display_name),
                    patch.get("internal_name", current.internal_name),
                    patch.get("type", current.type),
                    1 if patch.get("enabled", current.enabled) else 0,
                    1 if patch.get("visible_to_users", current.visible_to_users) else 0,
                    1 if patch.get("allow_auto_select", current.allow_auto_select) else 0,
                    1 if patch.get("is_default_for_user", current.is_default_for_user) else 0,
                    1 if patch.get("is_default_for_admin", current.is_default_for_admin) else 0,
                    patch.get("input_price_per_1k", current.input_price_per_1k),
                    patch.get("output_price_per_1k", current.output_price_per_1k),
                    patch.get("image_price_per_call", current.image_price_per_call),
                    patch.get("priority", current.priority),
                    patch.get("context_window", current.context_window),
                    json.dumps(patch.get("tags", current.tags), ensure_ascii=False),
                    json.dumps(patch.get("metadata_json", current.metadata_json), ensure_ascii=False),
                    now,
                    model_id,
                ),
            )
        return self.get_model(model_id)

    def delete_model(self, model_id: str) -> bool:
        with get_db() as connection:
            cursor = connection.execute(
                "UPDATE models SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                (self._now(), self._now(), model_id),
            )
            deleted = cursor.rowcount > 0
            if deleted:
                connection.execute(
                    "DELETE FROM model_fallbacks WHERE source_model_id = ? OR fallback_model_id = ?",
                    (model_id, model_id),
                )
                self._repair_routing_after_delete(connection, {model_id})
            return deleted

    def get_routing_policy(self) -> RoutingPolicyResponse:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT default_user_model_id, default_admin_model_id,
                       allow_user_model_switching, allow_auto_model_selection,
                       auto_model_strategy_default, fallback_enabled, updated_at
                FROM routing_policies
                WHERE id = 1
                """
            ).fetchone()
        if row is None:
            self.ensure_seed_data()
            return self.get_routing_policy()
        return RoutingPolicyResponse(
            default_user_model_id=row["default_user_model_id"],
            default_admin_model_id=row["default_admin_model_id"],
            allow_user_model_switching=bool(row["allow_user_model_switching"]),
            allow_auto_model_selection=bool(row["allow_auto_model_selection"]),
            auto_model_strategy_default=row["auto_model_strategy_default"],
            fallback_enabled=bool(row["fallback_enabled"]),
            updated_at=row["updated_at"],
        )

    def update_routing_policy(self, payload: UpdateRoutingPolicyRequest) -> RoutingPolicyResponse:
        current = self.get_routing_policy()
        patch = payload.model_dump(exclude_unset=True)
        now = self._now()
        with get_db() as connection:
            connection.execute(
                """
                UPDATE routing_policies
                SET default_user_model_id = ?, default_admin_model_id = ?,
                    allow_user_model_switching = ?, allow_auto_model_selection = ?,
                    auto_model_strategy_default = ?, fallback_enabled = ?, updated_at = ?
                WHERE id = 1
                """,
                (
                    patch.get("default_user_model_id", current.default_user_model_id),
                    patch.get("default_admin_model_id", current.default_admin_model_id),
                    1 if patch.get("allow_user_model_switching", current.allow_user_model_switching) else 0,
                    1 if patch.get("allow_auto_model_selection", current.allow_auto_model_selection) else 0,
                    patch.get("auto_model_strategy_default", current.auto_model_strategy_default),
                    1 if patch.get("fallback_enabled", current.fallback_enabled) else 0,
                    now,
                ),
            )
        return self.get_routing_policy()

    async def test_provider_connectivity(
        self, provider_id: str
    ) -> tuple[ProviderResponse | None, str, int | None, str]:
        runtime = self.get_provider_runtime(provider_id)
        if runtime is None:
            return None, "Provider not found.", None, self._now()
        checked_at = self._now()
        if provider_id == "mock":
            self.update_provider(provider_id, UpdateProviderRequest(status="healthy"))
            with get_db() as connection:
                connection.execute(
                    """
                    UPDATE providers
                    SET last_checked_at = ?, updated_at = ?
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (checked_at, checked_at, provider_id),
                )
                connection.execute(
                    """
                    INSERT INTO provider_health_checks (id, provider_id, status, latency_ms, checked_at, detail_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        uuid.uuid4().hex,
                        provider_id,
                        "healthy",
                        0,
                        checked_at,
                        json.dumps({"detail": "Mock provider is always reachable."}, ensure_ascii=False),
                    ),
                )
            return self.get_provider(provider_id), "Mock provider is always reachable.", 0, checked_at
        if not runtime["base_url"] or not runtime["api_key"]:
            self.update_provider(provider_id, UpdateProviderRequest(status="unhealthy"))
            with get_db() as connection:
                connection.execute(
                    """
                    UPDATE providers
                    SET last_checked_at = ?, updated_at = ?
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (checked_at, checked_at, provider_id),
                )
                connection.execute(
                    """
                    INSERT INTO provider_health_checks (id, provider_id, status, latency_ms, checked_at, detail_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        uuid.uuid4().hex,
                        provider_id,
                        "unhealthy",
                        None,
                        checked_at,
                        json.dumps({"detail": "Missing base URL or API key."}, ensure_ascii=False),
                    ),
                )
            return self.get_provider(provider_id), "Missing base URL or API key.", None, checked_at
        detail = "Provider connectivity verified."
        status_value = "healthy"
        latency_ms: int | None = None
        try:
            started = time.perf_counter()
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{runtime['base_url'].rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {runtime['api_key']}"},
                )
                response.raise_for_status()
            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        except Exception as exc:  # noqa: BLE001
            detail = f"Connectivity check failed: {type(exc).__name__}"
            status_value = "unhealthy"
            latency_ms = None
        self.update_provider(provider_id, UpdateProviderRequest(status=status_value))
        with get_db() as connection:
            connection.execute(
                """
                UPDATE providers
                SET last_checked_at = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (checked_at, checked_at, provider_id),
            )
            connection.execute(
                """
                INSERT INTO provider_health_checks (id, provider_id, status, latency_ms, checked_at, detail_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    provider_id,
                    status_value,
                    latency_ms,
                    checked_at,
                    json.dumps({"detail": detail}, ensure_ascii=False),
                ),
            )
            if status_value != "healthy":
                connection.execute(
                    """
                    INSERT INTO system_events (
                        id, level, source_type, source_id, title, message, detail_json, created_at, resolved_at
                    )
                    VALUES (?, 'warning', 'provider', ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        uuid.uuid4().hex,
                        provider_id,
                        f"Provider health check failed: {provider_id}",
                        detail,
                        json.dumps({"provider_id": provider_id, "detail": detail}, ensure_ascii=False),
                        checked_at,
                    ),
                )
        return self.get_provider(provider_id), detail, latency_ms, checked_at
