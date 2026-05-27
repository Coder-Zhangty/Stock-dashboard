from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.auth import SessionUser
from app.schemas.workspace import (
    WorkspaceModelFamilyOption,
    WorkspaceModelModeOption,
    WorkspaceSummaryResponse,
    WorkspaceUsageRecord,
    WorkspaceUsageSummary,
)
from app.services.provider_catalog_service import ProviderCatalogService
from app.services.user_governance_service import UserGovernanceService


class WorkspaceService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.provider_service = ProviderCatalogService(settings)
        self.governance = UserGovernanceService(settings)

    def _usage_summary(self, user_id: str) -> tuple[WorkspaceUsageSummary, list[WorkspaceUsageRecord]]:
        now = datetime.now(timezone.utc)
        day_floor = (now - timedelta(days=1)).isoformat()
        month_floor = (now - timedelta(days=30)).isoformat()
        with get_db() as connection:
            usage_row = connection.execute(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN total_tokens END), 0) AS today_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN prompt_tokens END), 0) AS today_input_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN completion_tokens END), 0) AS today_output_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN estimated_cost END), 0) AS today_cost,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN total_tokens END), 0) AS month_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN prompt_tokens END), 0) AS month_input_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN completion_tokens END), 0) AS month_output_tokens,
                    COALESCE(SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN estimated_cost END), 0) AS month_cost
                FROM usage_records
                WHERE user_id = ?
                """,
                (
                    day_floor,
                    day_floor,
                    day_floor,
                    day_floor,
                    month_floor,
                    month_floor,
                    month_floor,
                    month_floor,
                    user_id,
                ),
            ).fetchone()
            rows = connection.execute(
                """
                SELECT id, conversation_id, provider, model, mode,
                       prompt_tokens, completion_tokens, total_tokens,
                       estimated_cost, request_status, selected_strategy,
                       last_user_message_preview, created_at
                FROM chat_usage_events
                WHERE user_id = ?
                ORDER BY datetime(created_at) DESC
                LIMIT 24
                """,
                (user_id,),
            ).fetchall()

        controls = self.governance.ensure_user_controls(user_id)
        summary = WorkspaceUsageSummary(
            today_tokens=usage_row["today_tokens"],
            today_input_tokens=usage_row["today_input_tokens"],
            today_output_tokens=usage_row["today_output_tokens"],
            today_estimated_cost=round(float(usage_row["today_cost"] or 0), 4),
            month_tokens=usage_row["month_tokens"],
            month_input_tokens=usage_row["month_input_tokens"],
            month_output_tokens=usage_row["month_output_tokens"],
            remaining_daily_tokens=max(0, controls.token_quota_daily - usage_row["today_tokens"]),
            remaining_monthly_tokens=max(0, controls.token_quota_monthly - usage_row["month_tokens"]),
            monthly_estimated_cost=round(float(usage_row["month_cost"] or 0), 4),
            daily_quota=controls.token_quota_daily,
            monthly_quota=controls.token_quota_monthly,
        )
        records = [WorkspaceUsageRecord(**dict(row)) for row in rows]
        return summary, records

    def _model_families(self, allowed_model_ids: list[str]):
        families = [
            WorkspaceModelFamilyOption(
                id="general",
                label="通用对话",
                description="适合大多数聊天、写作和问答任务。",
                model_ids=[model_id for model_id in allowed_model_ids if "mock" not in model_id][:3],
            ),
            WorkspaceModelFamilyOption(
                id="quality",
                label="高质量回答",
                description="更适合复杂总结、长回答和高质量内容生成。",
                model_ids=[model_id for model_id in allowed_model_ids if "plus" in model_id or "max" in model_id],
            ),
            WorkspaceModelFamilyOption(
                id="vision",
                label="图像理解",
                description="用于多模态、图片和文档视觉理解。",
                model_ids=[model_id for model_id in allowed_model_ids if "vl" in model_id or "vision" in model_id],
            ),
            WorkspaceModelFamilyOption(
                id="fast",
                label="低成本快速",
                description="优先速度和成本，适合高频轻量对话。",
                model_ids=[model_id for model_id in allowed_model_ids if "mock" in model_id],
            ),
        ]
        return [family for family in families if family.model_ids]

    def get_workspace_summary(self, user: SessionUser) -> WorkspaceSummaryResponse:
        catalog = self.provider_service.get_catalog_for_user(user)
        controls = self.governance.ensure_user_controls(user.id)
        inherited_model_ids = [model.id for provider in catalog.providers for model in provider.models]
        inherited_provider_ids = [provider.id for provider in catalog.providers]
        allowed_model_ids = controls.allowed_model_ids or inherited_model_ids
        allowed_provider_ids = controls.allowed_provider_ids or inherited_provider_ids
        permissions = self.governance.resolve_feature_policy(user.id, catalog.permissions)
        usage, recent_usage = self._usage_summary(user.id)

        return WorkspaceSummaryResponse(
            usage=usage,
            permissions=permissions,
            allowed_model_ids=allowed_model_ids,
            allowed_provider_ids=allowed_provider_ids,
            max_selectable_models=controls.max_selectable_models,
            auto_model_selection_enabled=controls.auto_model_selection_enabled,
            can_use_vision_models=controls.can_use_vision_models,
            can_use_high_cost_models=controls.can_use_high_cost_models,
            default_model_id=controls.default_model_id or catalog.managed_default_model,
            mode_options=[
                WorkspaceModelModeOption(
                    id="auto",
                    label="自动",
                    description="让平台按当前任务在开放模型池中自动选择。",
                    strategy="auto",
                ),
                WorkspaceModelModeOption(
                    id="low_cost",
                    label="低成本优先",
                    description="优先使用更经济的模型。",
                    strategy="low_cost",
                ),
                WorkspaceModelModeOption(
                    id="high_quality",
                    label="效果优先",
                    description="优先使用回答质量更高的模型。",
                    strategy="high_quality",
                ),
                WorkspaceModelModeOption(
                    id="low_latency",
                    label="响应速度优先",
                    description="优先更快返回结果的模型。",
                    strategy="low_latency",
                ),
            ],
            model_families=self._model_families(allowed_model_ids),
            recent_usage=recent_usage,
        )
