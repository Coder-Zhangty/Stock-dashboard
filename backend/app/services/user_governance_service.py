from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.provider_catalog import UserPermissionPolicy


DEFAULT_DAILY_TOKEN_LIMIT = 160_000
DEFAULT_MONTHLY_TOKEN_LIMIT = 3_600_000
DEFAULT_REQUEST_LIMIT_DAILY = 180
DEFAULT_MAX_REQUEST_TOKENS = 12_000
DEFAULT_MAX_SELECTABLE_MODELS = 4


@dataclass
class UserControlState:
    user_id: str
    token_quota_daily: int
    token_quota_monthly: int
    total_credit_limit: float
    request_limit_daily: int
    max_request_tokens: int
    max_selectable_models: int
    auto_model_selection_enabled: bool
    can_use_vision_models: bool
    can_use_high_cost_models: bool
    allow_overage: bool
    overage_behavior: str
    default_model_id: str | None
    allowed_model_ids: list[str]
    allowed_provider_ids: list[str]
    feature_overrides: dict[str, bool]
    updated_at: str


class UserGovernanceService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _loads_json(raw: str | None, fallback):
        if not raw:
            return fallback
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return fallback

    @staticmethod
    def _default_feature_overrides() -> dict[str, bool]:
        return {
            "allow_library_upload": True,
            "allow_voice_mode": True,
            "allow_web_search": True,
            "allow_deep_research": True,
            "allow_image_tools": True,
            "allow_agent_mode": True,
        }

    def migrate_legacy_inherited_model_access(self) -> int:
        """Clear old auto-seeded allowlists so users inherit the global model pool."""
        default_features = self._default_feature_overrides()
        migrated = 0
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM user_control_settings
                WHERE allowed_model_ids != '[]' OR allowed_provider_ids != '[]'
                """
            ).fetchall()
            for row in rows:
                features = self._loads_json(row["feature_overrides"], default_features)
                is_default_control = (
                    int(row["token_quota_daily"]) == DEFAULT_DAILY_TOKEN_LIMIT
                    and int(row["token_quota_monthly"]) == DEFAULT_MONTHLY_TOKEN_LIMIT
                    and float(row["total_credit_limit"] or 0) == 0
                    and int(row["request_limit_daily"]) == DEFAULT_REQUEST_LIMIT_DAILY
                    and int(row["max_request_tokens"]) == DEFAULT_MAX_REQUEST_TOKENS
                    and int(row["max_selectable_models"]) == DEFAULT_MAX_SELECTABLE_MODELS
                    and bool(row["auto_model_selection_enabled"])
                    and bool(row["can_use_vision_models"])
                    and not bool(row["can_use_high_cost_models"])
                    and not bool(row["allow_overage"])
                    and row["overage_behavior"] == "notify"
                    and row["default_model_id"] is None
                    and features == default_features
                )
                if not is_default_control:
                    continue
                connection.execute(
                    """
                    UPDATE user_control_settings
                    SET allowed_model_ids = '[]',
                        allowed_provider_ids = '[]',
                        updated_at = ?
                    WHERE user_id = ?
                    """,
                    (now, row["user_id"]),
                )
                migrated += 1
        return migrated

    def ensure_user_controls(
        self,
        user_id: str,
        *,
        allowed_model_ids: list[str] | None = None,
        allowed_provider_ids: list[str] | None = None,
    ) -> UserControlState:
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as connection:
            row = connection.execute(
                "SELECT user_id FROM user_control_settings WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if row is None:
                connection.execute(
                    """
                    INSERT INTO user_control_settings (
                        user_id,
                        token_quota_daily,
                        token_quota_monthly,
                        total_credit_limit,
                        request_limit_daily,
                        max_request_tokens,
                        max_selectable_models,
                        auto_model_selection_enabled,
                        can_use_vision_models,
                        can_use_high_cost_models,
                        allow_overage,
                        overage_behavior,
                        default_model_id,
                        allowed_model_ids,
                        allowed_provider_ids,
                        feature_overrides,
                        updated_at
                    )
                    VALUES (?, ?, ?, 0, ?, ?, ?, 1, 1, 0, 0, 'notify', NULL, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        DEFAULT_DAILY_TOKEN_LIMIT,
                        DEFAULT_MONTHLY_TOKEN_LIMIT,
                        DEFAULT_REQUEST_LIMIT_DAILY,
                        DEFAULT_MAX_REQUEST_TOKENS,
                        DEFAULT_MAX_SELECTABLE_MODELS,
                        json.dumps(allowed_model_ids or []),
                        json.dumps(allowed_provider_ids or []),
                        json.dumps(self._default_feature_overrides()),
                        now,
                    ),
                )
        return self.get_user_controls(user_id)

    def get_user_controls(self, user_id: str) -> UserControlState:
        with get_db() as connection:
            row = connection.execute(
                "SELECT * FROM user_control_settings WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        if row is None:
            return self.ensure_user_controls(user_id)
        return UserControlState(
            user_id=row["user_id"],
            token_quota_daily=row["token_quota_daily"],
            token_quota_monthly=row["token_quota_monthly"],
            total_credit_limit=row["total_credit_limit"],
            request_limit_daily=row["request_limit_daily"],
            max_request_tokens=row["max_request_tokens"],
            max_selectable_models=row["max_selectable_models"],
            auto_model_selection_enabled=bool(row["auto_model_selection_enabled"]),
            can_use_vision_models=bool(row["can_use_vision_models"]),
            can_use_high_cost_models=bool(row["can_use_high_cost_models"]),
            allow_overage=bool(row["allow_overage"]),
            overage_behavior=row["overage_behavior"],
            default_model_id=row["default_model_id"],
            allowed_model_ids=self._loads_json(row["allowed_model_ids"], []),
            allowed_provider_ids=self._loads_json(row["allowed_provider_ids"], []),
            feature_overrides=self._loads_json(
                row["feature_overrides"],
                self._default_feature_overrides(),
            ),
            updated_at=row["updated_at"],
        )

    def list_user_controls(self, user_ids: list[str]) -> dict[str, UserControlState]:
        return {
            user_id: self.ensure_user_controls(user_id)
            for user_id in user_ids
        }

    def update_user_controls(self, user_id: str, patch: dict) -> UserControlState:
        current = self.ensure_user_controls(user_id)
        merged = {
            **current.__dict__,
            **patch,
            "feature_overrides": {
                **current.feature_overrides,
                **patch.get("feature_overrides", {}),
            },
        }
        with get_db() as connection:
            connection.execute(
                """
                UPDATE user_control_settings
                SET token_quota_daily = ?,
                    token_quota_monthly = ?,
                    total_credit_limit = ?,
                    request_limit_daily = ?,
                    max_request_tokens = ?,
                    max_selectable_models = ?,
                    auto_model_selection_enabled = ?,
                    can_use_vision_models = ?,
                    can_use_high_cost_models = ?,
                    allow_overage = ?,
                    overage_behavior = ?,
                    default_model_id = ?,
                    allowed_model_ids = ?,
                    allowed_provider_ids = ?,
                    feature_overrides = ?,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (
                    merged["token_quota_daily"],
                    merged["token_quota_monthly"],
                    merged["total_credit_limit"],
                    merged["request_limit_daily"],
                    merged["max_request_tokens"],
                    merged["max_selectable_models"],
                    1 if merged["auto_model_selection_enabled"] else 0,
                    1 if merged["can_use_vision_models"] else 0,
                    1 if merged["can_use_high_cost_models"] else 0,
                    1 if merged["allow_overage"] else 0,
                    merged["overage_behavior"],
                    merged["default_model_id"],
                    json.dumps(merged["allowed_model_ids"]),
                    json.dumps(merged["allowed_provider_ids"]),
                    json.dumps(merged["feature_overrides"]),
                    datetime.now(timezone.utc).isoformat(),
                    user_id,
                ),
            )
        return self.get_user_controls(user_id)

    def resolve_feature_policy(
        self,
        user_id: str,
        platform_policy: UserPermissionPolicy,
    ) -> UserPermissionPolicy:
        controls = self.ensure_user_controls(user_id)
        overrides = controls.feature_overrides
        payload = {
            "allow_library_upload": platform_policy.allow_library_upload and overrides.get("allow_library_upload", True),
            "allow_voice_mode": platform_policy.allow_voice_mode and overrides.get("allow_voice_mode", True),
            "allow_web_search": platform_policy.allow_web_search and overrides.get("allow_web_search", True),
            "allow_deep_research": platform_policy.allow_deep_research and overrides.get("allow_deep_research", True),
            "allow_image_tools": platform_policy.allow_image_tools and overrides.get("allow_image_tools", True),
            "allow_agent_mode": platform_policy.allow_agent_mode and overrides.get("allow_agent_mode", True),
        }
        return UserPermissionPolicy(**payload)
