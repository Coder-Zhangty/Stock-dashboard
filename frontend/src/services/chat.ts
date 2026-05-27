import type {
  ChatAttachment,
  ChatMessageUsage,
  ChatRequestMessage,
  ChatToneStyle,
  UserMemory,
  UserPreference,
} from '../types/chat'
import { readStoredToken } from './auth'
import { requestJson, streamSse } from './api'

interface StreamChatOptions {
  messages: ChatRequestMessage[]
  conversationId?: string
  model?: string
  mode?: string
  attachments?: ChatAttachment[]
  marketContext?: string | null
  signal?: AbortSignal
  onChunk: (chunk: string) => void
  onDone?: (usage: ChatMessageUsage | null) => void
  onError?: (message: string) => void
}

export const streamChat = async ({
  messages,
  conversationId,
  model,
  mode,
  attachments = [],
  marketContext = null,
  signal,
  onChunk,
  onDone,
  onError,
}: StreamChatOptions) => {
  await streamSse(
    '/api/chat',
    {
      messages,
      conversation_id: conversationId,
      model,
      mode,
      attachments,
      market_context: marketContext,
    },
    {
      token: readStoredToken(),
      signal,
      onChunk,
      onDone: (payload) => {
        onDone?.({
          provider: payload.provider ?? '',
          model: payload.model ?? model ?? '',
          mode: payload.mode ?? mode ?? 'instant',
          promptTokens: Number(payload.prompt_tokens ?? 0),
          completionTokens: Number(payload.completion_tokens ?? 0),
          totalTokens: Number(payload.total_tokens ?? 0),
          estimatedCost: Number(payload.estimated_cost ?? 0),
          requestStatus: payload.request_status ?? 'success',
          selectedStrategy: payload.selected_strategy ?? undefined,
          conversationId: payload.conversation_id ?? null,
        })
      },
      onError,
    },
  )
}

interface WorkspaceUsageSummaryDto {
  today_tokens: number
  today_input_tokens?: number
  today_output_tokens?: number
  today_estimated_cost?: number
  month_tokens: number
  month_input_tokens?: number
  month_output_tokens?: number
  remaining_daily_tokens: number
  remaining_monthly_tokens: number
  monthly_estimated_cost: number
  daily_quota: number
  monthly_quota: number
}

interface WorkspaceUsageRecordDto {
  id: string
  conversation_id: string | null
  provider: string
  model: string
  mode: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: number
  request_status: string
  selected_strategy: string | null
  last_user_message_preview: string
  created_at: string
}

interface WorkspaceModeOptionDto {
  id: string
  label: string
  description: string
  strategy: string
}

interface WorkspaceFamilyOptionDto {
  id: string
  label: string
  description: string
  model_ids: string[]
}

interface WorkspaceSummaryDto {
  usage: WorkspaceUsageSummaryDto
  permissions: {
    allow_library_upload: boolean
    allow_voice_mode: boolean
    allow_web_search: boolean
    allow_deep_research: boolean
    allow_image_tools: boolean
    allow_agent_mode: boolean
  }
  allowed_model_ids: string[]
  allowed_provider_ids: string[]
  max_selectable_models: number
  auto_model_selection_enabled: boolean
  can_use_vision_models: boolean
  can_use_high_cost_models: boolean
  default_model_id?: string | null
  mode_options: WorkspaceModeOptionDto[]
  model_families: WorkspaceFamilyOptionDto[]
  recent_usage: WorkspaceUsageRecordDto[]
}

export const fetchWorkspaceSummary = async () => {
  const token = readStoredToken()
  const response = await requestJson<WorkspaceSummaryDto>('/api/chat/workspace', { token })
  return {
    usage: {
      todayTokens: response.usage.today_tokens,
      todayInputTokens: response.usage.today_input_tokens ?? 0,
      todayOutputTokens: response.usage.today_output_tokens ?? 0,
      todayEstimatedCost: response.usage.today_estimated_cost ?? 0,
      monthTokens: response.usage.month_tokens,
      monthInputTokens: response.usage.month_input_tokens ?? 0,
      monthOutputTokens: response.usage.month_output_tokens ?? 0,
      remainingDailyTokens: response.usage.remaining_daily_tokens,
      remainingMonthlyTokens: response.usage.remaining_monthly_tokens,
      monthlyEstimatedCost: response.usage.monthly_estimated_cost,
      dailyQuota: response.usage.daily_quota,
      monthlyQuota: response.usage.monthly_quota,
    },
    permissions: {
      allowLibraryUpload: response.permissions.allow_library_upload,
      allowVoiceMode: response.permissions.allow_voice_mode,
      allowWebSearch: response.permissions.allow_web_search,
      allowDeepResearch: response.permissions.allow_deep_research,
      allowImageTools: response.permissions.allow_image_tools,
      allowAgentMode: response.permissions.allow_agent_mode,
    },
    allowedModelIds: response.allowed_model_ids,
    allowedProviderIds: response.allowed_provider_ids,
    maxSelectableModels: response.max_selectable_models,
    autoModelSelectionEnabled: response.auto_model_selection_enabled,
    canUseVisionModels: response.can_use_vision_models,
    canUseHighCostModels: response.can_use_high_cost_models,
    defaultModelId: response.default_model_id,
    modeOptions: response.mode_options.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      strategy: item.strategy,
    })),
    modelFamilies: response.model_families.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      modelIds: item.model_ids,
    })),
    recentUsage: response.recent_usage.map((item) => ({
      id: item.id,
      conversationId: item.conversation_id,
      provider: item.provider,
      model: item.model,
      mode: item.mode,
      promptTokens: item.prompt_tokens,
      completionTokens: item.completion_tokens,
      totalTokens: item.total_tokens,
      estimatedCost: item.estimated_cost,
      requestStatus: item.request_status,
      selectedStrategy: item.selected_strategy,
      lastUserMessagePreview: item.last_user_message_preview,
      createdAt: item.created_at,
    })),
  }
}

interface UserPreferenceDto {
  memory_enabled: boolean
  tone_style: ChatToneStyle
  warmth: number
  response_length: number
  updated_at?: string | null
}

interface UserMemoryDto {
  id: string
  user_id: string
  content: string
  source_conversation_id?: string | null
  confidence: number
  status: 'active' | 'deleted'
  created_at: string
  updated_at: string
}

const toPreference = (payload: UserPreferenceDto): UserPreference => ({
  memoryEnabled: payload.memory_enabled,
  toneStyle: payload.tone_style,
  warmth: payload.warmth,
  responseLength: payload.response_length,
  updatedAt: payload.updated_at ?? null,
})

const toMemory = (payload: UserMemoryDto): UserMemory => ({
  id: payload.id,
  userId: payload.user_id,
  content: payload.content,
  sourceConversationId: payload.source_conversation_id ?? null,
  confidence: payload.confidence,
  status: payload.status,
  createdAt: payload.created_at,
  updatedAt: payload.updated_at,
})

export const fetchChatPreferences = async () => {
  const token = readStoredToken()
  const response = await requestJson<UserPreferenceDto>('/api/chat/preferences', { token })
  return toPreference(response)
}

export const updateChatPreferences = async (payload: Partial<UserPreference>) => {
  const token = readStoredToken()
  const response = await requestJson<UserPreferenceDto>('/api/chat/preferences', {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memory_enabled: payload.memoryEnabled,
      tone_style: payload.toneStyle,
      warmth: payload.warmth,
      response_length: payload.responseLength,
    }),
  })
  return toPreference(response)
}

export const fetchUserMemories = async () => {
  const token = readStoredToken()
  const response = await requestJson<UserMemoryDto[]>('/api/chat/memories', { token })
  return response.map(toMemory)
}

export const deleteUserMemory = async (memoryId: string) => {
  const token = readStoredToken()
  return requestJson<{ success: boolean }>(`/api/chat/memories/${memoryId}`, {
    method: 'DELETE',
    token,
  })
}
