from pydantic import BaseModel, Field


class ProviderModelItem(BaseModel):
    id: str
    label: str
    available: bool
    description: str | None = None
    type: str | None = None
    context_window: int | None = None
    tags: list[str] = Field(default_factory=list)
    input_price_per_1k: float | None = None
    output_price_per_1k: float | None = None
    metadata_json: dict = Field(default_factory=dict)


class ProviderItem(BaseModel):
    id: str
    label: str
    available: bool
    status: str
    requires_api_key: bool
    supports: list[str]
    default_user_model: str
    default_admin_model: str
    description: str | None = None
    last_synced_at: str | None = None
    sync_status: str | None = None
    sync_error: str | None = None
    external_quota: dict | None = None
    models: list[ProviderModelItem]


class UserPermissionPolicy(BaseModel):
    allow_library_upload: bool = True
    allow_voice_mode: bool = True
    allow_web_search: bool = True
    allow_deep_research: bool = True
    allow_image_tools: bool = True
    allow_agent_mode: bool = True


class ProviderCatalogResponse(BaseModel):
    generated_at: str
    recommended_provider_id: str
    managed_provider_id: str
    managed_default_model: str
    allow_user_model_switch: bool = True
    permissions: UserPermissionPolicy = Field(default_factory=UserPermissionPolicy)
    providers: list[ProviderItem]


class ManagedModelOption(BaseModel):
    id: str
    label: str
    available: bool
    enabled_for_user: bool = True
    enabled_for_admin: bool = True
    allow_auto_select: bool = True
    description: str | None = None
    type: str | None = None
    context_window: int | None = None
    tags: list[str] = Field(default_factory=list)
    input_price_per_1k: float | None = None
    output_price_per_1k: float | None = None
    metadata_json: dict = Field(default_factory=dict)


class ManagedProviderConfig(BaseModel):
    id: str
    label: str
    available: bool
    status: str
    requires_api_key: bool
    supports: list[str]
    default_user_model: str
    default_admin_model: str
    enabled: bool = True
    visible_to_users: bool = True
    base_url: str = ""
    configured_model: str = ""
    has_api_key: bool = False
    api_key_hint: str | None = None
    api_key_input: str | None = None
    clear_api_key: bool = False
    last_checked_at: str | None = None
    last_ping_ms: int | None = None
    last_error_reason: str | None = None
    description: str | None = None
    last_synced_at: str | None = None
    sync_status: str | None = None
    sync_error: str | None = None
    external_quota: dict | None = None
    models: list[ManagedModelOption]


class ManagedRoutingState(BaseModel):
    user_default_provider: str
    user_default_model: str
    admin_default_provider: str
    admin_default_model: str
    allow_user_model_switch: bool = True


class ManagedRoutingUpdateRequest(BaseModel):
    managed_routing: ManagedRoutingState
    providers: list[ManagedProviderConfig]


class AdminProviderCatalogResponse(BaseModel):
    generated_at: str
    recommended_provider_id: str
    providers: list[ManagedProviderConfig]
    managed_routing: ManagedRoutingState
    permissions: UserPermissionPolicy
