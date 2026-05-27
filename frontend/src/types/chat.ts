export type ChatRole = 'system' | 'user' | 'assistant'

export type MessageStatus = 'idle' | 'streaming' | 'error' | 'cancelled'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  status?: MessageStatus
  usage?: ChatMessageUsage | null
  attachments?: ChatAttachment[]
}

export interface Conversation {
  id: string
  remoteId?: string | null
  title: string
  isCustomTitle?: boolean
  createdAt: string
  updatedAt: string
  selectedModelId?: string | null
  selectedProviderId?: string | null
  autoModelStrategy?: string | null
  messages: ChatMessage[]
}

export interface ChatRequestMessage {
  role: ChatRole
  content: string
}

export interface ChatAttachment {
  id: string
  name: string
  type: string
  source: string
  sizeLabel?: string | null
  createdAt?: string | null
}

export interface ChatPayload {
  content: string
  conversationId?: string
  model?: string
  mode?: string
  attachments?: ChatAttachment[]
  marketContext?: string | null
}

export interface EditMessagePayload {
  messageId: string
  content: string
  conversationId?: string
  model?: string
  mode?: string
  marketContext?: string | null
}

export interface ChatMessageUsage {
  provider: string
  model: string
  mode: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  requestStatus: string
  selectedStrategy?: string
  conversationId?: string | null
}

export interface UserPermissionPolicy {
  allowLibraryUpload: boolean
  allowVoiceMode: boolean
  allowWebSearch: boolean
  allowDeepResearch: boolean
  allowImageTools: boolean
  allowAgentMode: boolean
}

export interface ProviderModel {
  id: string
  label: string
  available: boolean
  description?: string | null
  type?: string | null
  contextWindow?: number | null
  tags: string[]
  inputPricePer1k?: number | null
  outputPricePer1k?: number | null
  metadataJson: Record<string, unknown>
}

export interface ProviderItem {
  id: string
  label: string
  available: boolean
  status: string
  requiresApiKey: boolean
  supports: string[]
  defaultUserModel: string
  defaultAdminModel: string
  description?: string | null
  lastSyncedAt?: string | null
  syncStatus?: string | null
  syncError?: string | null
  externalQuota?: Record<string, unknown> | null
  models: ProviderModel[]
}

export interface ManagedModelOption extends ProviderModel {
  enabledForUser: boolean
  enabledForAdmin: boolean
  allowAutoSelect: boolean
}

export interface ManagedProviderConfig {
  id: string
  label: string
  available: boolean
  status: string
  requiresApiKey: boolean
  supports: string[]
  defaultUserModel: string
  defaultAdminModel: string
  enabled: boolean
  visibleToUsers: boolean
  baseUrl: string
  configuredModel: string
  hasApiKey: boolean
  apiKeyHint?: string | null
  apiKeyInput?: string | null
  clearApiKey?: boolean
  lastCheckedAt?: string | null
  lastPingMs?: number | null
  lastErrorReason?: string | null
  description?: string | null
  lastSyncedAt?: string | null
  syncStatus?: string | null
  syncError?: string | null
  externalQuota?: Record<string, unknown> | null
  models: ManagedModelOption[]
}

export interface ManagedRoutingState {
  userDefaultProvider: string
  userDefaultModel: string
  adminDefaultProvider: string
  adminDefaultModel: string
  allowUserModelSwitch: boolean
}

export interface ProviderCatalog {
  generatedAt: string
  recommendedProviderId: string
  managedProviderId: string
  managedDefaultModel: string
  allowUserModelSwitch: boolean
  permissions: UserPermissionPolicy
  providers: ProviderItem[]
}

export interface AdminProviderCatalog {
  generatedAt: string
  recommendedProviderId: string
  providers: ManagedProviderConfig[]
  managedRouting: ManagedRoutingState
  permissions: UserPermissionPolicy
}

export interface WorkspaceUsageSummary {
  todayTokens: number
  todayInputTokens: number
  todayOutputTokens: number
  todayEstimatedCost: number
  monthTokens: number
  monthInputTokens: number
  monthOutputTokens: number
  remainingDailyTokens: number
  remainingMonthlyTokens: number
  monthlyEstimatedCost: number
  dailyQuota: number
  monthlyQuota: number
}

export interface WorkspaceUsageRecord {
  id: string
  conversationId?: string | null
  provider: string
  model: string
  mode: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  requestStatus: string
  selectedStrategy?: string | null
  lastUserMessagePreview: string
  createdAt: string
}

export interface WorkspaceModelModeOption {
  id: string
  label: string
  description: string
  strategy: string
}

export interface WorkspaceModelFamilyOption {
  id: string
  label: string
  description: string
  modelIds: string[]
}

export interface WorkspaceSummary {
  usage: WorkspaceUsageSummary
  permissions: UserPermissionPolicy
  allowedModelIds: string[]
  allowedProviderIds: string[]
  maxSelectableModels: number
  autoModelSelectionEnabled: boolean
  canUseVisionModels: boolean
  canUseHighCostModels: boolean
  defaultModelId?: string | null
  modeOptions: WorkspaceModelModeOption[]
  modelFamilies: WorkspaceModelFamilyOption[]
  recentUsage: WorkspaceUsageRecord[]
}

export type ChatToneStyle = 'professional' | 'friendly' | 'quirky' | 'honest'

export interface UserPreference {
  memoryEnabled: boolean
  toneStyle: ChatToneStyle
  warmth: number
  responseLength: number
  updatedAt?: string | null
}

export interface UserMemory {
  id: string
  userId: string
  content: string
  sourceConversationId?: string | null
  confidence: number
  status: 'active' | 'deleted'
  createdAt: string
  updatedAt: string
}
