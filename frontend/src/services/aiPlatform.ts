import type {
  AdminProviderCatalog,
  ManagedProviderConfig,
  ManagedRoutingState,
  ProviderCatalog,
  ProviderItem,
  UserPermissionPolicy,
} from '../types/chat'
import { requestJson } from './api'
import { readStoredToken } from './auth'

interface ProviderModelDto {
  id: string
  label: string
  available: boolean
  description?: string | null
  type?: string | null
  context_window?: number | null
  tags?: string[]
  input_price_per_1k?: number | null
  output_price_per_1k?: number | null
  metadata_json?: Record<string, unknown>
}

interface ProviderItemDto {
  id: string
  label: string
  available: boolean
  status: string
  requires_api_key: boolean
  supports: string[]
  default_user_model: string
  default_admin_model: string
  description?: string | null
  last_synced_at?: string | null
  sync_status?: string | null
  sync_error?: string | null
  external_quota?: Record<string, unknown> | null
  models: ProviderModelDto[]
}

interface UserPermissionPolicyDto {
  allow_library_upload: boolean
  allow_voice_mode: boolean
  allow_web_search: boolean
  allow_deep_research: boolean
  allow_image_tools: boolean
  allow_agent_mode: boolean
}

interface ProviderCatalogDto {
  generated_at: string
  recommended_provider_id: string
  managed_provider_id: string
  managed_default_model: string
  allow_user_model_switch: boolean
  permissions: UserPermissionPolicyDto
  providers: ProviderItemDto[]
}

interface ManagedModelOptionDto extends ProviderModelDto {
  enabled_for_user: boolean
  enabled_for_admin: boolean
  allow_auto_select?: boolean
}

interface ManagedProviderConfigDto extends Omit<ProviderItemDto, 'models'> {
  enabled: boolean
  visible_to_users: boolean
  base_url: string
  configured_model: string
  has_api_key: boolean
  api_key_hint?: string | null
  api_key_input?: string | null
  clear_api_key?: boolean
  last_checked_at?: string | null
  last_ping_ms?: number | null
  last_error_reason?: string | null
  models: ManagedModelOptionDto[]
}

interface ManagedRoutingStateDto {
  user_default_provider: string
  user_default_model: string
  admin_default_provider: string
  admin_default_model: string
  allow_user_model_switch: boolean
}

interface AdminProviderCatalogDto {
  generated_at: string
  recommended_provider_id: string
  providers: ManagedProviderConfigDto[]
  managed_routing: ManagedRoutingStateDto
  permissions: UserPermissionPolicyDto
}

const toPermissions = (payload: UserPermissionPolicyDto): UserPermissionPolicy => ({
  allowLibraryUpload: payload.allow_library_upload,
  allowVoiceMode: payload.allow_voice_mode,
  allowWebSearch: payload.allow_web_search,
  allowDeepResearch: payload.allow_deep_research,
  allowImageTools: payload.allow_image_tools,
  allowAgentMode: payload.allow_agent_mode,
})

const toProvider = (provider: ProviderItemDto): ProviderItem => ({
  id: provider.id,
  label: provider.label,
  available: provider.available,
  status: provider.status,
  requiresApiKey: provider.requires_api_key,
  supports: provider.supports,
  defaultUserModel: provider.default_user_model,
  defaultAdminModel: provider.default_admin_model,
  description: provider.description ?? null,
  lastSyncedAt: provider.last_synced_at ?? null,
  syncStatus: provider.sync_status ?? null,
  syncError: provider.sync_error ?? null,
  externalQuota: provider.external_quota ?? null,
  models: provider.models.map((model) => ({
    id: model.id,
    label: model.label,
    available: model.available,
    description: model.description ?? null,
    type: model.type ?? null,
    contextWindow: model.context_window ?? null,
    tags: model.tags ?? [],
    inputPricePer1k: model.input_price_per_1k ?? null,
    outputPricePer1k: model.output_price_per_1k ?? null,
    metadataJson: model.metadata_json ?? {},
  })),
})

const toManagedRouting = (payload: ManagedRoutingStateDto): ManagedRoutingState => ({
  userDefaultProvider: payload.user_default_provider,
  userDefaultModel: payload.user_default_model,
  adminDefaultProvider: payload.admin_default_provider,
  adminDefaultModel: payload.admin_default_model,
  allowUserModelSwitch: payload.allow_user_model_switch,
})

const toManagedProvider = (provider: ManagedProviderConfigDto): ManagedProviderConfig => ({
  id: provider.id,
  label: provider.label,
  available: provider.available,
  status: provider.status,
  requiresApiKey: provider.requires_api_key,
  supports: provider.supports,
  defaultUserModel: provider.default_user_model,
  defaultAdminModel: provider.default_admin_model,
  enabled: provider.enabled,
  visibleToUsers: provider.visible_to_users,
  baseUrl: provider.base_url,
  configuredModel: provider.configured_model,
  hasApiKey: provider.has_api_key,
  apiKeyHint: provider.api_key_hint,
  apiKeyInput: provider.api_key_input ?? '',
  clearApiKey: provider.clear_api_key ?? false,
  lastCheckedAt: provider.last_checked_at ?? null,
  lastPingMs: provider.last_ping_ms ?? null,
  lastErrorReason: provider.last_error_reason ?? null,
  description: provider.description ?? null,
  lastSyncedAt: provider.last_synced_at ?? null,
  syncStatus: provider.sync_status ?? null,
  syncError: provider.sync_error ?? null,
  externalQuota: provider.external_quota ?? null,
  models: provider.models.map((model) => ({
    id: model.id,
    label: model.label,
    available: model.available,
    enabledForUser: model.enabled_for_user,
    enabledForAdmin: model.enabled_for_admin,
    allowAutoSelect: model.allow_auto_select ?? model.enabled_for_user,
    description: model.description ?? null,
    type: model.type ?? null,
    contextWindow: model.context_window ?? null,
    tags: model.tags ?? [],
    inputPricePer1k: model.input_price_per_1k ?? null,
    outputPricePer1k: model.output_price_per_1k ?? null,
    metadataJson: model.metadata_json ?? {},
  })),
})

export const fetchCatalog = async (): Promise<ProviderCatalog> => {
  const token = readStoredToken()
  const response = await requestJson<ProviderCatalogDto>('/api/chat/providers', { token })
  return {
    generatedAt: response.generated_at,
    recommendedProviderId: response.recommended_provider_id,
    managedProviderId: response.managed_provider_id,
    managedDefaultModel: response.managed_default_model,
    allowUserModelSwitch: response.allow_user_model_switch,
    permissions: toPermissions(response.permissions),
    providers: response.providers.map(toProvider),
  }
}

export const fetchManagedRouting = async (): Promise<AdminProviderCatalog> => {
  const token = readStoredToken()
  const response = await requestJson<AdminProviderCatalogDto>('/api/admin/ai-platform/routing', {
    token,
  })
  return {
    generatedAt: response.generated_at,
    recommendedProviderId: response.recommended_provider_id,
    providers: response.providers.map(toManagedProvider),
    managedRouting: toManagedRouting(response.managed_routing),
    permissions: toPermissions(response.permissions),
  }
}

export const fetchAdminCatalog = async (): Promise<AdminProviderCatalog> => {
  const token = readStoredToken()
  const response = await requestJson<AdminProviderCatalogDto>('/api/admin/ai-platform/providers', {
    token,
  })
  return {
    generatedAt: response.generated_at,
    recommendedProviderId: response.recommended_provider_id,
    providers: response.providers.map(toManagedProvider),
    managedRouting: toManagedRouting(response.managed_routing),
    permissions: toPermissions(response.permissions),
  }
}

export const updateManagedRouting = async (payload: {
  managedRouting: ManagedRoutingState
  providers: ManagedProviderConfig[]
}) => {
  const token = readStoredToken()
  const response = await requestJson<AdminProviderCatalogDto>('/api/admin/ai-platform/routing', {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managed_routing: {
        user_default_provider: payload.managedRouting.userDefaultProvider,
        user_default_model: payload.managedRouting.userDefaultModel,
        admin_default_provider: payload.managedRouting.adminDefaultProvider,
        admin_default_model: payload.managedRouting.adminDefaultModel,
        allow_user_model_switch: payload.managedRouting.allowUserModelSwitch,
      },
      providers: payload.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        available: provider.available,
        status: provider.status,
        requires_api_key: provider.requiresApiKey,
        supports: provider.supports,
        default_user_model: provider.defaultUserModel,
        default_admin_model: provider.defaultAdminModel,
        enabled: provider.enabled,
        visible_to_users: provider.visibleToUsers,
        base_url: provider.baseUrl,
        configured_model: provider.configuredModel,
        has_api_key: provider.hasApiKey,
        api_key_hint: provider.apiKeyHint,
        api_key_input: provider.apiKeyInput?.trim() ? provider.apiKeyInput : null,
        clear_api_key: provider.clearApiKey ?? false,
        models: provider.models.map((model) => ({
          id: model.id,
          label: model.label,
          available: model.available,
          enabled_for_user: model.enabledForUser,
          enabled_for_admin: model.enabledForAdmin,
          allow_auto_select: model.allowAutoSelect,
        })),
      })),
    }),
  })
  return {
    generatedAt: response.generated_at,
    recommendedProviderId: response.recommended_provider_id,
    providers: response.providers.map(toManagedProvider),
    managedRouting: toManagedRouting(response.managed_routing),
    permissions: toPermissions(response.permissions),
  }
}

export const fetchPermissions = async () => {
  const token = readStoredToken()
  const response = await requestJson<UserPermissionPolicyDto>('/api/admin/permissions', { token })
  return toPermissions(response)
}

export const updatePermissions = async (payload: UserPermissionPolicy) => {
  const token = readStoredToken()
  const response = await requestJson<UserPermissionPolicyDto>('/api/admin/permissions', {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allow_library_upload: payload.allowLibraryUpload,
      allow_voice_mode: payload.allowVoiceMode,
      allow_web_search: payload.allowWebSearch,
      allow_deep_research: payload.allowDeepResearch,
      allow_image_tools: payload.allowImageTools,
      allow_agent_mode: payload.allowAgentMode,
    }),
  })
  return toPermissions(response)
}
