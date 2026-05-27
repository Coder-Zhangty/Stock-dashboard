import type { AuthSession } from '../types/auth'
import { requestJson } from './api'
import { readStoredToken } from './auth'

interface AdminUsersDto {
  items: Array<{
    id: string
    name: string
    email: string
    role: 'admin' | 'user'
    status: 'active' | 'disabled' | 'suspended' | 'blocked' | 'pending'
    created_at: string
    password_reset_required?: boolean
    last_login_at?: string | null
    disabled: boolean
    request_count: number
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    estimated_monthly_cost: number
    last_active_at: string | null
    last_model: string | null
    library_count: number
    token_quota_daily: number
    token_quota_monthly: number
    token_used_daily: number
    token_used_weekly: number
    token_used_monthly: number
    total_token_used: number
    allowed_model_ids: string[]
    allowed_provider_ids: string[]
    max_selectable_models: number
    auto_model_selection_enabled: boolean
    allow_overage: boolean
    overage_behavior: 'block' | 'downgrade' | 'notify'
    request_limit_daily: number
    max_request_tokens: number
    can_use_vision_models: boolean
    can_use_high_cost_models: boolean
    feature_overrides: {
      allow_library_upload: boolean
      allow_voice_mode: boolean
      allow_web_search: boolean
      allow_deep_research: boolean
      allow_image_tools: boolean
      allow_agent_mode: boolean
    }
  }>
}

interface AdminSystemStatusDto {
  status: string
  mock_mode: boolean
  provider: string
  default_model: string
  user_count: number
  library_count: number
  active_user_count: number
  request_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

const toSessionUser = (item: AdminUsersDto['items'][number]): AuthSession => ({
  userId: item.id,
  name: item.name,
  email: item.email,
  role: item.role,
  status: item.status,
  createdAt: item.created_at,
  accountType: item.role,
})

export const fetchUsers = async () => {
  const token = readStoredToken()
  const response = await requestJson<AdminUsersDto>('/api/admin/users', { token })
  return response.items.map((item) => ({
    ...toSessionUser(item),
    disabled: item.disabled,
    requestCount: item.request_count,
    promptTokens: item.prompt_tokens,
    completionTokens: item.completion_tokens,
    totalTokens: item.total_tokens,
    estimatedCostMonthly: item.estimated_monthly_cost,
    lastActiveAt: item.last_active_at,
    lastLoginAt: item.last_login_at ?? null,
    lastModel: item.last_model,
    libraryCount: item.library_count,
    tokenQuotaDaily: item.token_quota_daily,
    tokenQuotaMonthly: item.token_quota_monthly,
    tokenUsedDaily: item.token_used_daily,
    tokenUsedWeekly: item.token_used_weekly,
    tokenUsedMonthly: item.token_used_monthly,
    totalTokenUsed: item.total_token_used,
    allowedModelIds: item.allowed_model_ids,
    allowedProviderIds: item.allowed_provider_ids,
    maxSelectableModels: item.max_selectable_models,
    autoModelSelectionEnabled: item.auto_model_selection_enabled,
    allowOverage: item.allow_overage,
    overageBehavior: item.overage_behavior,
    requestLimitDaily: item.request_limit_daily,
    maxRequestTokens: item.max_request_tokens,
    canUseVisionModels: item.can_use_vision_models,
    canUseHighCostModels: item.can_use_high_cost_models,
    canUseFeature: {
      allowLibraryUpload: item.feature_overrides.allow_library_upload,
      allowVoiceMode: item.feature_overrides.allow_voice_mode,
      allowWebSearch: item.feature_overrides.allow_web_search,
      allowDeepResearch: item.feature_overrides.allow_deep_research,
      allowImageTools: item.feature_overrides.allow_image_tools,
      allowAgentMode: item.feature_overrides.allow_agent_mode,
    },
  }))
}

export const disableUser = async (userId: string) => {
  const token = readStoredToken()
  await requestJson(`/api/admin/users/${userId}/disable`, {
    method: 'POST',
    token,
  })
}

export const enableUser = async (userId: string) => {
  const token = readStoredToken()
  await requestJson(`/api/admin/users/${userId}/enable`, {
    method: 'POST',
    token,
  })
}

export const deleteUser = async (userId: string) => {
  const token = readStoredToken()
  await requestJson(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    token,
  })
}

export const fetchSystemStatus = async () => {
  const token = readStoredToken()
  const response = await requestJson<AdminSystemStatusDto>('/api/admin/system/status', {
    token,
  })
  return {
    status: response.status,
    mockMode: response.mock_mode,
    provider: response.provider,
    defaultModel: response.default_model,
    userCount: response.user_count,
    libraryCount: response.library_count,
    activeUserCount: response.active_user_count,
    requestCount: response.request_count,
    promptTokens: response.prompt_tokens,
    completionTokens: response.completion_tokens,
    totalTokens: response.total_tokens,
  }
}

interface AdminOverviewDto {
  system: AdminSystemStatusDto
  users: AdminUsersDto['items']
  recent_activity: Array<{
    id: string
    user_id: string | null
    user_name: string
    user_email: string
    role: string
    provider: string
    model: string
    mode: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    attachment_count: number
    last_user_message_preview: string
    created_at: string
  }>
  library_items: Array<{
    id: string
    owner_id: string | null
    name: string
    type: string
    kind: string
    source: string
    size_label: string
    created_at: string
    owner_name: string | null
    owner_email: string | null
  }>
  audit_logs?: Array<{
    id: string
    actor_id?: string | null
    actor_name: string
    actor_role: string
    action_type: string
    target_type: string
    target_id?: string | null
    target_label: string
    detail: string
    result: string
    created_at: string
  }>
}

export const fetchAdminOverview = async () => {
  const token = readStoredToken()
  const response = await requestJson<AdminOverviewDto>('/api/admin/overview', { token })
  return {
    system: {
      status: response.system.status,
      mockMode: response.system.mock_mode,
      provider: response.system.provider,
      defaultModel: response.system.default_model,
      userCount: response.system.user_count,
      libraryCount: response.system.library_count,
      activeUserCount: response.system.active_user_count,
      requestCount: response.system.request_count,
      promptTokens: response.system.prompt_tokens,
      completionTokens: response.system.completion_tokens,
      totalTokens: response.system.total_tokens,
    },
    users: response.users.map((item) => ({
      ...toSessionUser(item),
      disabled: item.disabled,
      requestCount: item.request_count,
      promptTokens: item.prompt_tokens,
      completionTokens: item.completion_tokens,
      totalTokens: item.total_tokens,
      estimatedCostMonthly: item.estimated_monthly_cost,
      lastActiveAt: item.last_active_at,
      lastLoginAt: item.last_login_at ?? null,
      lastModel: item.last_model,
      libraryCount: item.library_count,
      tokenQuotaDaily: item.token_quota_daily,
      tokenQuotaMonthly: item.token_quota_monthly,
      tokenUsedDaily: item.token_used_daily,
      tokenUsedWeekly: item.token_used_weekly,
      tokenUsedMonthly: item.token_used_monthly,
      totalTokenUsed: item.total_token_used,
      allowedModelIds: item.allowed_model_ids,
      allowedProviderIds: item.allowed_provider_ids,
      maxSelectableModels: item.max_selectable_models,
      autoModelSelectionEnabled: item.auto_model_selection_enabled,
      allowOverage: item.allow_overage,
      overageBehavior: item.overage_behavior,
      requestLimitDaily: item.request_limit_daily,
      maxRequestTokens: item.max_request_tokens,
      canUseVisionModels: item.can_use_vision_models,
      canUseHighCostModels: item.can_use_high_cost_models,
      canUseFeature: {
        allowLibraryUpload: item.feature_overrides.allow_library_upload,
        allowVoiceMode: item.feature_overrides.allow_voice_mode,
        allowWebSearch: item.feature_overrides.allow_web_search,
        allowDeepResearch: item.feature_overrides.allow_deep_research,
        allowImageTools: item.feature_overrides.allow_image_tools,
        allowAgentMode: item.feature_overrides.allow_agent_mode,
      },
    })),
    recentActivity: response.recent_activity.map((item) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name,
      userEmail: item.user_email,
      role: item.role,
      provider: item.provider,
      model: item.model,
      mode: item.mode,
      promptTokens: item.prompt_tokens,
      completionTokens: item.completion_tokens,
      totalTokens: item.total_tokens,
      attachmentCount: item.attachment_count,
      promptPreview: item.last_user_message_preview,
      createdAt: item.created_at,
    })),
    libraryItems: response.library_items.map((item) => ({
      id: item.id,
      ownerId: item.owner_id,
      name: item.name,
      type: item.type,
      kind: item.kind,
      source: item.source,
      sizeLabel: item.size_label,
      createdAt: item.created_at,
      ownerName: item.owner_name,
      ownerEmail: item.owner_email,
    })),
    auditLogs:
      response.audit_logs?.map((item) => ({
        id: item.id,
        actor: item.actor_name,
        actorRole: item.actor_role === 'admin' || item.actor_role === 'user' ? item.actor_role : 'system',
        actionType: item.action_type,
        target: item.target_label,
        detail: item.detail,
        result: item.result === 'error' ? 'error' : item.result === 'warning' ? 'warning' : 'success',
        timestamp: item.created_at,
      })) ?? [],
  }
}

export const createUser = async (payload: {
  name: string
  email: string
  password: string
  role: 'admin' | 'user'
}) => {
  const token = readStoredToken()
  const response = await requestJson<{ success: boolean; user: AdminUsersDto['items'][number] }>(
    '/api/admin/users',
    {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  const item = response.user
  return {
    ...toSessionUser(item),
    disabled: item.disabled,
    requestCount: item.request_count,
    promptTokens: item.prompt_tokens,
    completionTokens: item.completion_tokens,
    totalTokens: item.total_tokens,
    estimatedCostMonthly: item.estimated_monthly_cost,
    lastActiveAt: item.last_active_at,
    lastLoginAt: item.last_login_at ?? null,
    lastModel: item.last_model,
    libraryCount: item.library_count,
    tokenQuotaDaily: item.token_quota_daily,
    tokenQuotaMonthly: item.token_quota_monthly,
    tokenUsedDaily: item.token_used_daily,
    tokenUsedWeekly: item.token_used_weekly,
    tokenUsedMonthly: item.token_used_monthly,
    totalTokenUsed: item.total_token_used,
    allowedModelIds: item.allowed_model_ids,
    allowedProviderIds: item.allowed_provider_ids,
    maxSelectableModels: item.max_selectable_models,
    autoModelSelectionEnabled: item.auto_model_selection_enabled,
    allowOverage: item.allow_overage,
    overageBehavior: item.overage_behavior,
    requestLimitDaily: item.request_limit_daily,
    maxRequestTokens: item.max_request_tokens,
    canUseVisionModels: item.can_use_vision_models,
    canUseHighCostModels: item.can_use_high_cost_models,
    canUseFeature: {
      allowLibraryUpload: item.feature_overrides.allow_library_upload,
      allowVoiceMode: item.feature_overrides.allow_voice_mode,
      allowWebSearch: item.feature_overrides.allow_web_search,
      allowDeepResearch: item.feature_overrides.allow_deep_research,
      allowImageTools: item.feature_overrides.allow_image_tools,
      allowAgentMode: item.feature_overrides.allow_agent_mode,
    },
  }
}

export const updateUser = async (
  userId: string,
  patch: Record<string, unknown>,
) => {
  const token = readStoredToken()
  const featureOverrides = patch.feature_overrides ?? patch.canUseFeature
  const typedFeatureOverrides =
    featureOverrides && typeof featureOverrides === 'object'
      ? (featureOverrides as {
          allowLibraryUpload: boolean
          allowVoiceMode: boolean
          allowWebSearch: boolean
          allowDeepResearch: boolean
          allowImageTools: boolean
          allowAgentMode: boolean
        })
      : null
  const normalizedPatch: Record<string, unknown> = {
    status: patch.status,
    token_quota_daily: patch.tokenQuotaDaily,
    token_quota_monthly: patch.tokenQuotaMonthly,
    request_limit_daily: patch.requestLimitDaily,
    max_request_tokens: patch.maxRequestTokens,
    max_selectable_models: patch.maxSelectableModels,
    auto_model_selection_enabled: patch.autoModelSelectionEnabled,
    allow_overage: patch.allowOverage,
    overage_behavior: patch.overageBehavior,
    can_use_vision_models: patch.canUseVisionModels,
    can_use_high_cost_models: patch.canUseHighCostModels,
    allowed_model_ids: patch.allowedModelIds,
    allowed_provider_ids: patch.allowedProviderIds,
    default_model_id: patch.defaultModelId,
  }
  const response = await requestJson<{ success: boolean; user: AdminUsersDto['items'][number] }>(
    `/api/admin/users/${userId}`,
    {
      method: 'PATCH',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...normalizedPatch,
        feature_overrides: typedFeatureOverrides
          ? {
              allow_library_upload: typedFeatureOverrides.allowLibraryUpload,
              allow_voice_mode: typedFeatureOverrides.allowVoiceMode,
              allow_web_search: typedFeatureOverrides.allowWebSearch,
              allow_deep_research: typedFeatureOverrides.allowDeepResearch,
              allow_image_tools: typedFeatureOverrides.allowImageTools,
              allow_agent_mode: typedFeatureOverrides.allowAgentMode,
            }
          : undefined,
      }),
    },
  )
  return response.user
}

export const resetUserPassword = async (userId: string, password: string) => {
  const token = readStoredToken()
  return requestJson(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

interface ProviderDto {
  id: string
  name: string
  type: string
  base_url: string
  api_key_masked?: string | null
  enabled: boolean
  visible_to_users: boolean
  status: string
  description?: string | null
  last_checked_at?: string | null
  created_at: string
  updated_at: string
}

interface ProviderTestDto {
  provider: ProviderDto
  detail: string
  latency_ms?: number | null
  checked_at?: string | null
}

interface ModelDto {
  id: string
  provider_id: string
  display_name: string
  internal_name: string
  type: string
  enabled: boolean
  visible_to_users: boolean
  allow_auto_select: boolean
  is_default_for_user: boolean
  is_default_for_admin: boolean
  input_price_per_1k?: number | null
  output_price_per_1k?: number | null
  image_price_per_call?: number | null
  priority: number
  context_window?: number | null
  tags: string[]
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const createProvider = async (payload: {
  id: string
  name: string
  type: 'openai' | 'openai_compatible' | 'qwen' | 'gemini' | 'anthropic' | 'deepseek' | 'custom' | 'mock'
  baseUrl: string
  apiKey?: string
  enabled?: boolean
  visibleToUsers?: boolean
  description?: string
}) => {
  const token = readStoredToken()
  return requestJson<ProviderDto>('/api/admin/providers', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: payload.id,
      name: payload.name,
      type: payload.type,
      base_url: payload.baseUrl,
      api_key: payload.apiKey?.trim() || undefined,
      enabled: payload.enabled ?? true,
      visible_to_users: payload.visibleToUsers ?? true,
      description: payload.description?.trim() || undefined,
    }),
  })
}

export const createModel = async (payload: {
  id: string
  providerId: string
  displayName: string
  internalName: string
  type: 'chat' | 'vision' | 'image' | 'embedding' | 'audio'
  enabled?: boolean
  visibleToUsers?: boolean
  allowAutoSelect?: boolean
  isDefaultForUser?: boolean
  isDefaultForAdmin?: boolean
  inputPricePer1k?: number
  outputPricePer1k?: number
  imagePricePerCall?: number
  priority?: number
  contextWindow?: number
  tags?: string[]
}) => {
  const token = readStoredToken()
  return requestJson<ModelDto>('/api/admin/models', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: payload.id,
      provider_id: payload.providerId,
      display_name: payload.displayName,
      internal_name: payload.internalName,
      type: payload.type,
      enabled: payload.enabled ?? true,
      visible_to_users: payload.visibleToUsers ?? true,
      allow_auto_select: payload.allowAutoSelect ?? true,
      is_default_for_user: payload.isDefaultForUser ?? false,
      is_default_for_admin: payload.isDefaultForAdmin ?? false,
      input_price_per_1k: payload.inputPricePer1k ?? 0,
      output_price_per_1k: payload.outputPricePer1k ?? 0,
      image_price_per_call: payload.imagePricePerCall ?? 0,
      priority: payload.priority ?? 0,
      context_window: payload.contextWindow,
      tags: payload.tags ?? [],
      metadata_json: {},
    }),
  })
}

export const testProvider = async (providerId: string) => {
  const token = readStoredToken()
  return requestJson<ProviderTestDto>(`/api/admin/providers/${providerId}/test`, {
    method: 'POST',
    token,
  })
}

export const syncProvider = async (providerId: string) => {
  const token = readStoredToken()
  return requestJson<{
    status: string
    detail: string
    model_count: number
    created_count: number
    updated_count: number
    quota_status: string
    quota?: Record<string, unknown> | null
    synced_at: string
  }>(`/api/admin/providers/${providerId}/sync`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      include_models: true,
      include_quota: true,
    }),
  })
}

export const deleteProvider = async (providerId: string) => {
  const token = readStoredToken()
  return requestJson<{ success: boolean }>(`/api/admin/providers/${providerId}`, {
    method: 'DELETE',
    token,
  })
}

export const deleteModel = async (modelId: string) => {
  const token = readStoredToken()
  return requestJson<{ success: boolean }>(`/api/admin/models/${modelId}`, {
    method: 'DELETE',
    token,
  })
}

export const fetchAdminUserMemories = async (userId: string) => {
  const token = readStoredToken()
  return requestJson<
    Array<{
      id: string
      user_id: string
      content: string
      source_conversation_id?: string | null
      confidence: number
      status: 'active' | 'deleted'
      created_at: string
      updated_at: string
    }>
  >(`/api/admin/users/${userId}/memories`, { token })
}

export const deleteAdminUserMemory = async (userId: string, memoryId: string) => {
  const token = readStoredToken()
  return requestJson<{ success: boolean }>(`/api/admin/users/${userId}/memories/${memoryId}`, {
    method: 'DELETE',
    token,
  })
}
