from pydantic import BaseModel, Field

from app.schemas.auth import SessionUser
from app.schemas.library import LibraryItem
from app.schemas.provider_catalog import UserPermissionPolicy


class AdminUserItem(SessionUser):
    disabled: bool
    request_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_monthly_cost: float = 0
    last_active_at: str | None = None
    last_model: str | None = None
    library_count: int = 0
    token_quota_daily: int = 0
    token_quota_monthly: int = 0
    token_used_daily: int = 0
    token_used_weekly: int = 0
    token_used_monthly: int = 0
    total_token_used: int = 0
    allowed_model_ids: list[str] = Field(default_factory=list)
    allowed_provider_ids: list[str] = Field(default_factory=list)
    max_selectable_models: int = 0
    auto_model_selection_enabled: bool = True
    allow_overage: bool = False
    overage_behavior: str = "notify"
    request_limit_daily: int = 0
    max_request_tokens: int = 0
    can_use_vision_models: bool = True
    can_use_high_cost_models: bool = False
    feature_overrides: UserPermissionPolicy = Field(default_factory=UserPermissionPolicy)


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]


class AdminActionResponse(BaseModel):
    success: bool
    user: AdminUserItem | None = None


class AdminSystemStatusResponse(BaseModel):
    status: str
    mock_mode: bool
    provider: str
    default_model: str
    user_count: int
    library_count: int
    active_user_count: int
    request_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class AdminActivityItem(BaseModel):
    id: str
    user_id: str | None = None
    user_name: str
    user_email: str
    role: str
    provider: str
    model: str
    mode: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    attachment_count: int
    last_user_message_preview: str
    created_at: str


class AdminLibraryItem(LibraryItem):
    owner_name: str | None = None
    owner_email: str | None = None


class AdminAuditLogItem(BaseModel):
    id: str
    actor_id: str | None = None
    actor_name: str
    actor_role: str
    action_type: str
    target_type: str
    target_id: str | None = None
    target_label: str
    detail: str
    result: str
    created_at: str


class AdminOverviewResponse(BaseModel):
    system: AdminSystemStatusResponse
    users: list[AdminUserItem]
    recent_activity: list[AdminActivityItem]
    library_items: list[AdminLibraryItem]
    audit_logs: list[AdminAuditLogItem] = Field(default_factory=list)


class PermissionPolicyResponse(UserPermissionPolicy):
    pass


class AdminCreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=120)
    role: str = Field(pattern="^(admin|user)$")


class AdminResetPasswordRequest(BaseModel):
    password: str = Field(min_length=6, max_length=120)


class AdminUserUpdateRequest(BaseModel):
    status: str | None = Field(default=None, pattern="^(active|disabled|suspended)$")
    token_quota_daily: int | None = None
    token_quota_monthly: int | None = None
    request_limit_daily: int | None = None
    max_request_tokens: int | None = None
    max_selectable_models: int | None = None
    auto_model_selection_enabled: bool | None = None
    allow_overage: bool | None = None
    overage_behavior: str | None = Field(default=None, pattern="^(block|downgrade|notify)$")
    can_use_vision_models: bool | None = None
    can_use_high_cost_models: bool | None = None
    allowed_model_ids: list[str] | None = None
    allowed_provider_ids: list[str] | None = None
    default_model_id: str | None = None
    feature_overrides: UserPermissionPolicy | None = None
