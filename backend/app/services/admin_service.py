from __future__ import annotations

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.admin import (
    AdminActivityItem,
    AdminAuditLogItem,
    AdminLibraryItem,
    AdminOverviewResponse,
    AdminSystemStatusResponse,
    AdminUserItem,
)
from app.schemas.auth import SessionUser
from app.services.auth_service import AuthService
from app.services.audit_log_service import AuditLogService
from app.services.library_service import LibraryService
from app.services.provider_catalog_service import ProviderCatalogService
from app.services.user_governance_service import UserGovernanceService


class AdminService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.auth_service = AuthService(settings)
        self.audit_log_service = AuditLogService(settings)
        self.library_service = LibraryService(settings)
        self.provider_service = ProviderCatalogService(settings)
        self.user_governance_service = UserGovernanceService(settings)

    def _usage_summary_by_user(self) -> dict[str, dict]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT
                    user_id,
                    COUNT(*) AS request_count,
                    COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
                    COALESCE(SUM(total_tokens), 0) AS total_tokens,
                    MAX(created_at) AS last_active_at
                FROM usage_records
                WHERE user_id IS NOT NULL
                GROUP BY user_id
                """
            ).fetchall()
            latest_rows = connection.execute(
                """
                SELECT user_id, model_id AS model, MAX(created_at) AS created_at
                FROM usage_records
                WHERE user_id IS NOT NULL
                GROUP BY user_id
                """
            ).fetchall()

        summaries = {
            row["user_id"]: {
                "request_count": row["request_count"],
                "prompt_tokens": row["prompt_tokens"],
                "completion_tokens": row["completion_tokens"],
                "total_tokens": row["total_tokens"],
                "last_active_at": row["last_active_at"],
                "last_model": None,
            }
            for row in rows
        }
        for row in latest_rows:
            if row["user_id"] in summaries:
                summaries[row["user_id"]]["last_model"] = row["model"]
        return summaries

    def _library_counts_by_user(self) -> dict[str, int]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT owner_id, COUNT(*) AS file_count
                FROM library_items
                WHERE owner_id IS NOT NULL
                GROUP BY owner_id
                """
            ).fetchall()
        return {row["owner_id"]: row["file_count"] for row in rows}

    def _daily_monthly_usage(self, user_id: str) -> dict[str, int]:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-1 day') THEN total_tokens END), 0) AS token_used_daily,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-7 day') THEN total_tokens END), 0) AS token_used_weekly,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime('now', '-30 day') THEN total_tokens END), 0) AS token_used_monthly
                FROM usage_records
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
        return {
            "token_used_daily": row["token_used_daily"] if row else 0,
            "token_used_weekly": row["token_used_weekly"] if row else 0,
            "token_used_monthly": row["token_used_monthly"] if row else 0,
        }

    def _to_admin_user(self, user, usage: dict | None = None, library_count: int = 0) -> AdminUserItem:
        usage = usage or {}
        controls = self.user_governance_service.ensure_user_controls(user.id)
        usage_window = self._daily_monthly_usage(user.id)
        estimated_cost = round(
            ((usage.get("prompt_tokens", 0) / 1000) * 0.0022)
            + ((usage.get("completion_tokens", 0) / 1000) * 0.0068),
            4,
        )
        return AdminUserItem(
            **user.model_dump(exclude={"last_active_at"}),
            disabled=user.status != "active",
            request_count=usage.get("request_count", 0),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            estimated_monthly_cost=estimated_cost,
            last_active_at=usage.get("last_active_at"),
            last_model=usage.get("last_model"),
            library_count=library_count,
            token_quota_daily=controls.token_quota_daily,
            token_quota_monthly=controls.token_quota_monthly,
            token_used_daily=usage_window["token_used_daily"],
            token_used_weekly=usage_window["token_used_weekly"],
            token_used_monthly=usage_window["token_used_monthly"],
            total_token_used=usage.get("total_tokens", 0),
            allowed_model_ids=controls.allowed_model_ids,
            allowed_provider_ids=controls.allowed_provider_ids,
            max_selectable_models=controls.max_selectable_models,
            auto_model_selection_enabled=controls.auto_model_selection_enabled,
            allow_overage=controls.allow_overage,
            overage_behavior=controls.overage_behavior,
            request_limit_daily=controls.request_limit_daily,
            max_request_tokens=controls.max_request_tokens,
            can_use_vision_models=controls.can_use_vision_models,
            can_use_high_cost_models=controls.can_use_high_cost_models,
            feature_overrides=controls.feature_overrides,
        )

    def list_users(self) -> list[AdminUserItem]:
        usage_by_user = self._usage_summary_by_user()
        library_counts = self._library_counts_by_user()
        return [
            self._to_admin_user(
                user,
                usage=usage_by_user.get(user.id),
                library_count=library_counts.get(user.id, 0),
            )
            for user in self.auth_service.list_users()
        ]

    def disable_user(self, user_id: str) -> AdminUserItem | None:
        user = self.auth_service.set_user_status(user_id, "disabled")
        return self._to_admin_user(user) if user else None

    def enable_user(self, user_id: str) -> AdminUserItem | None:
        user = self.auth_service.set_user_status(user_id, "active")
        return self._to_admin_user(user) if user else None

    def delete_user(self, user_id: str) -> bool:
        return self.auth_service.delete_user(user_id)

    def get_system_status(self) -> AdminSystemStatusResponse:
        users = self.auth_service.list_users()
        library_items = self.library_service.list_items()
        catalog = self.provider_service.get_admin_catalog()
        with get_db() as connection:
            usage = connection.execute(
                """
                SELECT
                    COUNT(*) AS request_count,
                    COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
                    COALESCE(SUM(total_tokens), 0) AS total_tokens
                FROM usage_records
                """
            ).fetchone()
        runtime = self.provider_service.get_provider_runtime(catalog.managed_routing.user_default_provider)
        return AdminSystemStatusResponse(
            status="ok",
            mock_mode=self.settings.mock_mode or catalog.managed_routing.user_default_provider == "mock" or not (runtime and runtime.api_key),
            provider=catalog.managed_routing.user_default_provider,
            default_model=catalog.managed_routing.user_default_model,
            user_count=len(users),
            library_count=len(library_items),
            active_user_count=sum(1 for user in users if user.status == "active"),
            request_count=usage["request_count"],
            prompt_tokens=usage["prompt_tokens"],
            completion_tokens=usage["completion_tokens"],
            total_tokens=usage["total_tokens"],
        )

    def list_recent_activity(self, limit: int = 12) -> list[AdminActivityItem]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, user_id, user_name, user_email, role, provider, model, mode,
                       prompt_tokens, completion_tokens, total_tokens, attachment_count,
                       last_user_message_preview, created_at
                FROM chat_usage_events
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [AdminActivityItem(**dict(row)) for row in rows]

    def list_library_overview(self, limit: int = 18) -> list[AdminLibraryItem]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT
                    library_items.id,
                    library_items.owner_id,
                    library_items.name,
                    library_items.type,
                    library_items.kind,
                    library_items.source,
                    library_items.size_label,
                    library_items.created_at,
                    users.name AS owner_name,
                    users.email AS owner_email
                FROM library_items
                LEFT JOIN users ON users.id = library_items.owner_id
                ORDER BY datetime(library_items.created_at) DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [AdminLibraryItem(**dict(row)) for row in rows]

    def list_audit_logs(self, limit: int = 80) -> list[AdminAuditLogItem]:
        return [AdminAuditLogItem(**row) for row in self.audit_log_service.list_recent(limit)]

    def create_user(
        self,
        *,
        actor: SessionUser,
        name: str,
        email: str,
        password: str,
        role: str,
    ) -> AdminUserItem:
        user = self.auth_service.create_user(name=name, email=email, password=password, role=role)
        self.audit_log_service.record(
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role,
            action_type="create_user",
            target_type="user",
            target_id=user.id,
            target_label=user.email,
            detail=f"Created {role} account for {user.name}.",
        )
        return self._to_admin_user(user)

    def reset_user_password(self, *, actor: SessionUser, user_id: str, password: str) -> AdminUserItem | None:
        user = self.auth_service.reset_password(user_id, password)
        if user:
            self.audit_log_service.record(
                actor_id=actor.id,
                actor_name=actor.name,
                actor_role=actor.role,
                action_type="reset_password",
                target_type="user",
                target_id=user.id,
                target_label=user.email,
                detail=f"Reset password for {user.name}.",
            )
            return self._to_admin_user(user)
        return None

    def update_user_controls(self, *, actor: SessionUser, user_id: str, patch: dict) -> AdminUserItem | None:
        if "status" in patch and patch["status"]:
            self.auth_service.set_user_status(user_id, patch["status"])
        controls_patch = {
            key: value
            for key, value in patch.items()
            if key
            in {
                "token_quota_daily",
                "token_quota_monthly",
                "request_limit_daily",
                "max_request_tokens",
                "max_selectable_models",
                "auto_model_selection_enabled",
                "allow_overage",
                "overage_behavior",
                "can_use_vision_models",
                "can_use_high_cost_models",
                "allowed_model_ids",
                "allowed_provider_ids",
                "default_model_id",
                "feature_overrides",
            }
            and value is not None
        }
        if controls_patch:
            self.user_governance_service.update_user_controls(user_id, controls_patch)
        user = self.auth_service.get_user_by_id(user_id)
        if user is None:
            return None
        self.audit_log_service.record(
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role,
            action_type="update_user_controls",
            target_type="user",
            target_id=user.id,
            target_label=user.email,
            detail="Updated per-user quota, model access, or policy controls.",
        )
        usage_by_user = self._usage_summary_by_user()
        library_counts = self._library_counts_by_user()
        return self._to_admin_user(
            user,
            usage=usage_by_user.get(user.id),
            library_count=library_counts.get(user.id, 0),
        )

    def get_overview(self) -> AdminOverviewResponse:
        return AdminOverviewResponse(
            system=self.get_system_status(),
            users=self.list_users(),
            recent_activity=self.list_recent_activity(),
            library_items=self.list_library_overview(),
            audit_logs=self.list_audit_logs(),
        )
