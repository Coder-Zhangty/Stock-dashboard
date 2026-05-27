from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.config import Settings
from app.core.database import get_db
from app.core.secrets import SecretsManager
from app.schemas.provider_catalog import ManagedRoutingState, UserPermissionPolicy


PERMISSION_DEFAULTS = {
    "allow_library_upload": True,
    "allow_voice_mode": True,
    "allow_web_search": True,
    "allow_deep_research": True,
    "allow_image_tools": True,
    "allow_agent_mode": True,
}

LEGACY_PROVIDER_ID = "openai-compatible"
CURRENT_MANAGED_PROVIDER_ID = "aliyun-bailian"
DEFAULT_MANAGED_MODEL_ID = "qwen3-vl-plus"


@dataclass
class ProviderRuntimeDefinition:
    id: str
    default_user_model: str
    default_admin_model: str
    model_ids: list[str]
    default_base_url: str = ""


@dataclass
class ProviderRuntimeState:
    provider_id: str
    base_url: str
    configured_model: str
    api_key: str | None
    has_api_key: bool
    api_key_hint: str | None
    updated_at: str


class ManagedConfigService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.secrets = SecretsManager(settings)

    def ensure_defaults(self, providers: list[ProviderRuntimeDefinition]) -> None:
        if not providers:
            return

        fallback_provider = next((provider for provider in providers if provider.id == "mock"), providers[0])
        user_provider = fallback_provider
        admin_provider = fallback_provider
        now = datetime.now(timezone.utc).isoformat()

        with get_db() as connection:
            for provider in providers:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO managed_provider_settings (provider_id, enabled, visible_to_users)
                    VALUES (?, 1, ?)
                    """,
                    (provider.id, 1),
                )
                for model_id in provider.model_ids:
                    for role_scope in ("user", "admin"):
                        connection.execute(
                            """
                            INSERT OR IGNORE INTO managed_model_settings (provider_id, model_id, role_scope, enabled)
                            VALUES (?, ?, ?, 1)
                            """,
                            (provider.id, model_id, role_scope),
                        )

                default_configured_model = provider.default_user_model
                seed_base_url = provider.default_base_url
                seed_api_key = None

                if provider.id == CURRENT_MANAGED_PROVIDER_ID:
                    default_configured_model = self.settings.model or provider.default_user_model
                    seed_base_url = self.settings.base_url
                    seed_api_key = self.settings.api_key or None

                encrypted_key = self.secrets.encrypt(seed_api_key) if seed_api_key else None

                connection.execute(
                    """
                    INSERT OR IGNORE INTO provider_runtime_configs (
                        provider_id,
                        base_url,
                        configured_model,
                        api_key_encrypted,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (provider.id, seed_base_url, default_configured_model, encrypted_key, now),
                )

                if provider.id == CURRENT_MANAGED_PROVIDER_ID and seed_api_key:
                    existing = connection.execute(
                        """
                        SELECT api_key_encrypted, base_url, configured_model
                        FROM provider_runtime_configs
                        WHERE provider_id = ?
                        """,
                        (provider.id,),
                    ).fetchone()
                    if existing and not existing["api_key_encrypted"]:
                        connection.execute(
                            """
                            UPDATE provider_runtime_configs
                            SET api_key_encrypted = ?, base_url = ?, configured_model = ?, updated_at = ?
                            WHERE provider_id = ?
                            """,
                            (
                                encrypted_key,
                                existing["base_url"] or seed_base_url,
                                existing["configured_model"] or default_configured_model,
                                now,
                                provider.id,
                            ),
                        )

                if provider.id == CURRENT_MANAGED_PROVIDER_ID:
                    legacy_runtime = connection.execute(
                        """
                        SELECT base_url, configured_model, api_key_encrypted
                        FROM provider_runtime_configs
                        WHERE provider_id = ?
                        """,
                        (LEGACY_PROVIDER_ID,),
                    ).fetchone()
                    current_runtime = connection.execute(
                        """
                        SELECT base_url, configured_model, api_key_encrypted
                        FROM provider_runtime_configs
                        WHERE provider_id = ?
                        """,
                        (CURRENT_MANAGED_PROVIDER_ID,),
                    ).fetchone()
                    if legacy_runtime and current_runtime:
                        current_key = current_runtime["api_key_encrypted"]
                        current_base_url = current_runtime["base_url"] or ""
                        current_model = current_runtime["configured_model"] or ""
                        legacy_model = legacy_runtime["configured_model"] or ""
                        migrated_model = current_model
                        if not migrated_model or migrated_model.startswith("gpt") or migrated_model.startswith("o3"):
                            migrated_model = (
                                legacy_model
                                if legacy_model and not legacy_model.startswith("gpt") and not legacy_model.startswith("o3")
                                else provider.default_user_model
                            )
                        if not current_key and legacy_runtime["api_key_encrypted"]:
                            connection.execute(
                                """
                                UPDATE provider_runtime_configs
                                SET api_key_encrypted = ?, base_url = ?, configured_model = ?, updated_at = ?
                                WHERE provider_id = ?
                                """,
                                (
                                    legacy_runtime["api_key_encrypted"],
                                    current_base_url or legacy_runtime["base_url"] or seed_base_url,
                                    migrated_model,
                                    now,
                                    CURRENT_MANAGED_PROVIDER_ID,
                                ),
                            )
                    if current_runtime:
                        current_base_url = current_runtime["base_url"] or ""
                        current_model = current_runtime["configured_model"] or ""
                        if (
                            "api.openai.com" in current_base_url
                            or current_model.startswith("gpt")
                            or current_model.startswith("o3")
                        ):
                            connection.execute(
                                """
                                UPDATE provider_runtime_configs
                                SET base_url = ?, configured_model = ?, updated_at = ?
                                WHERE provider_id = ?
                                """,
                                (
                                    seed_base_url,
                                    provider.default_user_model,
                                    now,
                                    CURRENT_MANAGED_PROVIDER_ID,
                                ),
                            )

            existing_routing = connection.execute(
                "SELECT id FROM managed_routing_settings WHERE id = 1"
            ).fetchone()
            if existing_routing is None:
                connection.execute(
                    """
                    INSERT INTO managed_routing_settings (
                        id,
                        user_default_provider,
                        user_default_model,
                        admin_default_provider,
                        admin_default_model,
                        allow_user_model_switch
                    )
                    VALUES (1, ?, ?, ?, ?, 1)
                    """,
                    (
                        user_provider.id,
                        user_provider.default_user_model,
                        admin_provider.id,
                        admin_provider.default_admin_model,
                    ),
                )
            else:
                routing_row = connection.execute(
                    """
                    SELECT user_default_provider, user_default_model,
                           admin_default_provider, admin_default_model
                    FROM managed_routing_settings
                    WHERE id = 1
                    """
                ).fetchone()
                if routing_row:
                    user_provider_id = routing_row["user_default_provider"]
                    admin_provider_id = routing_row["admin_default_provider"]
                    user_model_id = routing_row["user_default_model"]
                    admin_model_id = routing_row["admin_default_model"]
                    current_managed_runtime = connection.execute(
                        """
                        SELECT api_key_encrypted
                        FROM provider_runtime_configs
                        WHERE provider_id = ?
                        """,
                        (CURRENT_MANAGED_PROVIDER_ID,),
                    ).fetchone()
                    has_live_managed_key = bool(
                        current_managed_runtime and current_managed_runtime["api_key_encrypted"]
                    )

                    if user_provider_id == LEGACY_PROVIDER_ID:
                        user_provider_id = CURRENT_MANAGED_PROVIDER_ID
                    if admin_provider_id == LEGACY_PROVIDER_ID:
                        admin_provider_id = CURRENT_MANAGED_PROVIDER_ID
                    if user_model_id.startswith("gpt") or user_model_id.startswith("o3"):
                        user_model_id = DEFAULT_MANAGED_MODEL_ID
                    if admin_model_id.startswith("gpt") or admin_model_id.startswith("o3"):
                        admin_model_id = DEFAULT_MANAGED_MODEL_ID
                    if has_live_managed_key and user_provider_id == "mock":
                        user_provider_id = CURRENT_MANAGED_PROVIDER_ID
                        user_model_id = DEFAULT_MANAGED_MODEL_ID
                    if has_live_managed_key and admin_provider_id == "mock":
                        admin_provider_id = CURRENT_MANAGED_PROVIDER_ID
                        admin_model_id = DEFAULT_MANAGED_MODEL_ID

                    connection.execute(
                        """
                        UPDATE managed_routing_settings
                        SET user_default_provider = ?,
                            user_default_model = ?,
                            admin_default_provider = ?,
                            admin_default_model = ?
                        WHERE id = 1
                        """,
                        (
                            user_provider_id,
                            user_model_id,
                            admin_provider_id,
                            admin_model_id,
                        ),
                    )

            for key, enabled in PERMISSION_DEFAULTS.items():
                connection.execute(
                    """
                    INSERT OR IGNORE INTO permission_settings (key, enabled)
                    VALUES (?, ?)
                    """,
                    (key, 1 if enabled else 0),
                )

    def get_routing_state(self) -> ManagedRoutingState:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT user_default_provider, user_default_model,
                       admin_default_provider, admin_default_model,
                       allow_user_model_switch
                FROM managed_routing_settings
                WHERE id = 1
                """
            ).fetchone()
        if row is None:
            raise RuntimeError("Managed routing settings have not been initialized.")
        return ManagedRoutingState(
            user_default_provider=row["user_default_provider"],
            user_default_model=row["user_default_model"],
            admin_default_provider=row["admin_default_provider"],
            admin_default_model=row["admin_default_model"],
            allow_user_model_switch=bool(row["allow_user_model_switch"]),
        )

    def get_provider_settings(self) -> dict[str, dict[str, bool]]:
        with get_db() as connection:
            rows = connection.execute(
                "SELECT provider_id, enabled, visible_to_users FROM managed_provider_settings"
            ).fetchall()
        return {
            row["provider_id"]: {
                "enabled": bool(row["enabled"]),
                "visible_to_users": bool(row["visible_to_users"]),
            }
            for row in rows
        }

    def get_model_settings(self) -> dict[tuple[str, str], dict[str, bool]]:
        with get_db() as connection:
            rows = connection.execute(
                "SELECT provider_id, model_id, role_scope, enabled FROM managed_model_settings"
            ).fetchall()
        settings: dict[tuple[str, str], dict[str, bool]] = {}
        for row in rows:
            key = (row["provider_id"], row["model_id"])
            settings.setdefault(key, {"user": False, "admin": False})
            settings[key][row["role_scope"]] = bool(row["enabled"])
        return settings

    def get_runtime_settings(self) -> dict[str, ProviderRuntimeState]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT provider_id, base_url, configured_model, api_key_encrypted, updated_at
                FROM provider_runtime_configs
                """
            ).fetchall()

        runtime: dict[str, ProviderRuntimeState] = {}
        for row in rows:
            decrypted_key = None
            encrypted_key = row["api_key_encrypted"]
            if encrypted_key:
                decrypted_key = self.secrets.decrypt(encrypted_key)
            runtime[row["provider_id"]] = ProviderRuntimeState(
                provider_id=row["provider_id"],
                base_url=row["base_url"] or "",
                configured_model=row["configured_model"] or "",
                api_key=decrypted_key,
                has_api_key=bool(decrypted_key),
                api_key_hint=self.secrets.mask(decrypted_key),
                updated_at=row["updated_at"],
            )
        return runtime

    def get_runtime_setting(self, provider_id: str) -> ProviderRuntimeState | None:
        return self.get_runtime_settings().get(provider_id)

    def get_permissions(self) -> UserPermissionPolicy:
        with get_db() as connection:
            rows = connection.execute(
                "SELECT key, enabled FROM permission_settings"
            ).fetchall()
        payload = {key: value for key, value in PERMISSION_DEFAULTS.items()}
        for row in rows:
            if row["key"] in payload:
                payload[row["key"]] = bool(row["enabled"])
        return UserPermissionPolicy(**payload)

    def update_permissions(self, payload: UserPermissionPolicy) -> UserPermissionPolicy:
        with get_db() as connection:
            for key, enabled in payload.model_dump().items():
                connection.execute(
                    """
                    INSERT INTO permission_settings (key, enabled)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled
                    """,
                    (key, 1 if enabled else 0),
                )
        return self.get_permissions()

    def update_routing(
        self,
        routing: ManagedRoutingState,
        providers: list[dict],
    ) -> ManagedRoutingState:
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO managed_routing_settings (
                    id,
                    user_default_provider,
                    user_default_model,
                    admin_default_provider,
                    admin_default_model,
                    allow_user_model_switch
                )
                VALUES (1, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_default_provider = excluded.user_default_provider,
                    user_default_model = excluded.user_default_model,
                    admin_default_provider = excluded.admin_default_provider,
                    admin_default_model = excluded.admin_default_model,
                    allow_user_model_switch = excluded.allow_user_model_switch
                """,
                (
                    routing.user_default_provider,
                    routing.user_default_model,
                    routing.admin_default_provider,
                    routing.admin_default_model,
                    1 if routing.allow_user_model_switch else 0,
                ),
            )

            for provider in providers:
                connection.execute(
                    """
                    INSERT INTO managed_provider_settings (provider_id, enabled, visible_to_users)
                    VALUES (?, ?, ?)
                    ON CONFLICT(provider_id) DO UPDATE SET
                        enabled = excluded.enabled,
                        visible_to_users = excluded.visible_to_users
                    """,
                    (
                        provider["id"],
                        1 if provider["enabled"] else 0,
                        1 if provider["visible_to_users"] else 0,
                    ),
                )

                existing_runtime = connection.execute(
                    """
                    SELECT api_key_encrypted
                    FROM provider_runtime_configs
                    WHERE provider_id = ?
                    """,
                    (provider["id"],),
                ).fetchone()

                api_key_encrypted = existing_runtime["api_key_encrypted"] if existing_runtime else None
                if provider.get("clear_api_key"):
                    api_key_encrypted = None
                elif provider.get("api_key_input"):
                    api_key_encrypted = self.secrets.encrypt(provider["api_key_input"])

                connection.execute(
                    """
                    INSERT INTO provider_runtime_configs (
                        provider_id,
                        base_url,
                        configured_model,
                        api_key_encrypted,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(provider_id) DO UPDATE SET
                        base_url = excluded.base_url,
                        configured_model = excluded.configured_model,
                        api_key_encrypted = excluded.api_key_encrypted,
                        updated_at = excluded.updated_at
                    """,
                    (
                        provider["id"],
                        provider.get("base_url", ""),
                        provider.get("configured_model", ""),
                        api_key_encrypted,
                        now,
                    ),
                )

                for model in provider["models"]:
                    connection.execute(
                        """
                        INSERT INTO managed_model_settings (provider_id, model_id, role_scope, enabled)
                        VALUES (?, ?, 'user', ?)
                        ON CONFLICT(provider_id, model_id, role_scope) DO UPDATE SET
                            enabled = excluded.enabled
                        """,
                        (
                            provider["id"],
                            model["id"],
                            1 if model["enabled_for_user"] else 0,
                        ),
                    )
                    connection.execute(
                        """
                        INSERT INTO managed_model_settings (provider_id, model_id, role_scope, enabled)
                        VALUES (?, ?, 'admin', ?)
                        ON CONFLICT(provider_id, model_id, role_scope) DO UPDATE SET
                            enabled = excluded.enabled
                        """,
                        (
                            provider["id"],
                            model["id"],
                            1 if model["enabled_for_admin"] else 0,
                        ),
                    )
        return self.get_routing_state()
