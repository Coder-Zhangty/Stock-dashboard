from __future__ import annotations

from pydantic import BaseModel, Field


class MessageAttachmentResponse(BaseModel):
    id: str
    name: str
    type: str
    source: str | None = None
    size_label: str | None = None
    created_at: str | None = None


class ProviderResponse(BaseModel):
    id: str
    name: str
    type: str
    base_url: str
    api_key_masked: str | None = None
    enabled: bool
    visible_to_users: bool = True
    status: str
    description: str | None = None
    last_checked_at: str | None = None
    last_synced_at: str | None = None
    sync_status: str | None = None
    sync_error: str | None = None
    external_quota: dict | None = None
    created_at: str
    updated_at: str


class CreateProviderRequest(BaseModel):
    id: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(
        pattern="^(openai|openai_compatible|qwen|gemini|anthropic|deepseek|moonshot|zhipu|minimax|baichuan|stepfun|hunyuan|doubao|siliconflow|openrouter|groq|xai|mistral|cohere|custom|mock)$"
    )
    base_url: str = Field(min_length=0, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    enabled: bool = True
    visible_to_users: bool = True
    description: str | None = Field(default=None, max_length=500)


class UpdateProviderRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(
        default=None,
        pattern="^(openai|openai_compatible|qwen|gemini|anthropic|deepseek|moonshot|zhipu|minimax|baichuan|stepfun|hunyuan|doubao|siliconflow|openrouter|groq|xai|mistral|cohere|custom|mock)$",
    )
    base_url: str | None = Field(default=None, min_length=0, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    clear_api_key: bool | None = None
    enabled: bool | None = None
    visible_to_users: bool | None = None
    status: str | None = Field(default=None, pattern="^(healthy|unhealthy|unknown|disabled)$")
    description: str | None = Field(default=None, max_length=500)


class ModelResponse(BaseModel):
    id: str
    provider_id: str
    display_name: str
    internal_name: str
    type: str
    enabled: bool
    visible_to_users: bool
    allow_auto_select: bool
    is_default_for_user: bool
    is_default_for_admin: bool
    input_price_per_1k: float | None = None
    output_price_per_1k: float | None = None
    image_price_per_call: float | None = None
    priority: int
    context_window: int | None = None
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict = Field(default_factory=dict)
    description: str | None = None
    created_at: str
    updated_at: str


class ProviderSyncRequest(BaseModel):
    include_models: bool = True
    include_quota: bool = True


class ProviderSyncResponse(BaseModel):
    provider: ProviderResponse
    status: str
    detail: str
    model_count: int = 0
    created_count: int = 0
    updated_count: int = 0
    quota_status: str = "unsupported"
    quota: dict | None = None
    synced_at: str


class CreateModelRequest(BaseModel):
    id: str = Field(min_length=2, max_length=120)
    provider_id: str = Field(min_length=2, max_length=64)
    display_name: str = Field(min_length=1, max_length=120)
    internal_name: str = Field(min_length=1, max_length=120)
    type: str = Field(pattern="^(chat|vision|image|embedding|audio)$")
    enabled: bool = True
    visible_to_users: bool = True
    allow_auto_select: bool = True
    is_default_for_user: bool = False
    is_default_for_admin: bool = False
    input_price_per_1k: float | None = Field(default=None, ge=0)
    output_price_per_1k: float | None = Field(default=None, ge=0)
    image_price_per_call: float | None = Field(default=None, ge=0)
    priority: int = 0
    context_window: int | None = Field(default=None, ge=1)
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict = Field(default_factory=dict)


class UpdateModelRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    internal_name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(default=None, pattern="^(chat|vision|image|embedding|audio)$")
    enabled: bool | None = None
    visible_to_users: bool | None = None
    allow_auto_select: bool | None = None
    is_default_for_user: bool | None = None
    is_default_for_admin: bool | None = None
    input_price_per_1k: float | None = Field(default=None, ge=0)
    output_price_per_1k: float | None = Field(default=None, ge=0)
    image_price_per_call: float | None = Field(default=None, ge=0)
    priority: int | None = None
    context_window: int | None = Field(default=None, ge=1)
    tags: list[str] | None = None
    metadata_json: dict | None = None


class RoutingPolicyResponse(BaseModel):
    default_user_model_id: str | None = None
    default_admin_model_id: str | None = None
    allow_user_model_switching: bool = True
    allow_auto_model_selection: bool = True
    auto_model_strategy_default: str = "high_quality"
    fallback_enabled: bool = True
    updated_at: str | None = None


class UpdateRoutingPolicyRequest(BaseModel):
    default_user_model_id: str | None = None
    default_admin_model_id: str | None = None
    allow_user_model_switching: bool | None = None
    allow_auto_model_selection: bool | None = None
    auto_model_strategy_default: str | None = Field(
        default=None,
        pattern="^(low_cost|high_quality|low_latency)$",
    )
    fallback_enabled: bool | None = None


class ProviderTestResponse(BaseModel):
    provider: ProviderResponse
    detail: str
    latency_ms: int | None = None
    checked_at: str | None = None


class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    selected_model_id: str | None = None
    auto_model_strategy: str | None = None
    last_message_at: str
    created_at: str
    updated_at: str
    archived_at: str | None = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    user_id: str | None = None
    role: str
    content_text: str
    model_id: str | None = None
    provider_id: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost: float | None = None
    created_at: str
    attachments: list[MessageAttachmentResponse] = Field(default_factory=list)


class ConversationImportMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content_text: str = Field(min_length=0, max_length=20000)
    model_id: str | None = None
    provider_id: str | None = None
    created_at: str | None = None
    attachments: list[MessageAttachmentResponse] = Field(default_factory=list)


class ConversationImportItem(BaseModel):
    client_id: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=200)
    selected_model_id: str | None = None
    auto_model_strategy: str | None = Field(
        default=None,
        pattern="^(auto|low_cost|high_quality|low_latency)$",
    )
    created_at: str | None = None
    updated_at: str | None = None
    messages: list[ConversationImportMessage] = Field(default_factory=list)


class ImportLocalConversationsRequest(BaseModel):
    conversations: list[ConversationImportItem] = Field(default_factory=list, max_length=200)


class ReplaceConversationMessagesRequest(BaseModel):
    messages: list[ConversationImportMessage] = Field(default_factory=list, max_length=500)


class CreateConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    selected_model_id: str | None = None
    auto_model_strategy: str | None = Field(
        default=None,
        pattern="^(auto|low_cost|high_quality|low_latency)$",
    )


class UpdateConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    selected_model_id: str | None = None
    auto_model_strategy: str | None = Field(
        default=None,
        pattern="^(auto|low_cost|high_quality|low_latency)$",
    )
    archived: bool | None = None


class SendConversationMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    selected_model_id: str | None = None
    auto_model_strategy: str | None = Field(
        default=None,
        pattern="^(auto|low_cost|high_quality|low_latency)$",
    )
    attached_file_ids: list[str] = Field(default_factory=list)
