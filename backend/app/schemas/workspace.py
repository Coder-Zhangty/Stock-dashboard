from pydantic import BaseModel

from app.schemas.provider_catalog import UserPermissionPolicy


class WorkspaceUsageSummary(BaseModel):
    today_tokens: int
    today_input_tokens: int = 0
    today_output_tokens: int = 0
    today_estimated_cost: float = 0
    month_tokens: int
    month_input_tokens: int = 0
    month_output_tokens: int = 0
    remaining_daily_tokens: int
    remaining_monthly_tokens: int
    monthly_estimated_cost: float
    daily_quota: int
    monthly_quota: int


class WorkspaceUsageRecord(BaseModel):
    id: str
    conversation_id: str | None = None
    provider: str
    model: str
    mode: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float
    request_status: str
    selected_strategy: str | None = None
    last_user_message_preview: str
    created_at: str


class WorkspaceModelModeOption(BaseModel):
    id: str
    label: str
    description: str
    strategy: str


class WorkspaceModelFamilyOption(BaseModel):
    id: str
    label: str
    description: str
    model_ids: list[str]


class WorkspaceSummaryResponse(BaseModel):
    usage: WorkspaceUsageSummary
    permissions: UserPermissionPolicy
    allowed_model_ids: list[str]
    allowed_provider_ids: list[str]
    max_selectable_models: int
    auto_model_selection_enabled: bool
    can_use_vision_models: bool
    can_use_high_cost_models: bool
    default_model_id: str | None = None
    mode_options: list[WorkspaceModelModeOption]
    model_families: list[WorkspaceModelFamilyOption]
    recent_usage: list[WorkspaceUsageRecord]
