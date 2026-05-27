import type { AdminProviderCatalog, ManagedProviderConfig, UserPermissionPolicy } from './chat'

export type AdminSection =
  | 'overview'
  | 'users'
  | 'models'
  | 'quotas'
  | 'library'
  | 'system'
  | 'policies'
  | 'logs'

export type AdminUserStatus = 'active' | 'suspended' | 'blocked' | 'pending' | 'disabled'
export type QuotaBehavior = 'block' | 'downgrade' | 'notify' | 'allow'
export type AuditResult = 'success' | 'warning' | 'error'
export type ProviderRuntimeStatus = 'available' | 'error' | 'warning' | 'unverified'
export type ModelType = 'chat' | 'vision' | 'embedding' | 'image' | 'audio'
export type AutoRoutingStrategy = 'cost' | 'quality' | 'latency'
export type EventLevel = 'info' | 'warning' | 'error' | 'critical'

export interface UserActivityEntry {
  id: string
  title: string
  description: string
  timestamp: string
  tone?: EventLevel
}

export interface AdminUserRecord {
  userId: string
  name: string
  email: string
  role: 'admin' | 'user'
  status: AdminUserStatus
  createdAt: string
  accountType?: 'admin' | 'user'
  accessToken?: string
  requestCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokenQuotaDaily: number
  tokenQuotaMonthly: number
  tokenUsedDaily: number
  tokenUsedWeekly: number
  tokenUsedMonthly: number
  totalTokenUsed: number
  libraryCount: number
  lastActiveAt: string | null
  lastLoginAt: string | null
  lastModel: string | null
  allowedModelIds: string[]
  allowedProviderIds: string[]
  maxSelectableModels: number
  autoModelSelectionEnabled: boolean
  allowOverage: boolean
  overageBehavior: QuotaBehavior
  requestLimitDaily: number
  maxRequestTokens: number
  estimatedCostMonthly: number
  estimatedCostLifetime: number
  canUseVisionModels: boolean
  canUseHighCostModels: boolean
  canUseFeature: UserPermissionPolicy
  overQuota: boolean
  passwordResetRequired?: boolean
  defaultModelId?: string | null
  recentRequests: UserActivityEntry[]
  recentUploads: UserActivityEntry[]
  recentEvents: UserActivityEntry[]
  recentModelSwitches: UserActivityEntry[]
  isLocalOnly?: boolean
}

export interface OverviewMetricCard {
  id: string
  label: string
  value: string
  change: string
  tone?: 'default' | 'success' | 'warning'
  targetSection?: AdminSection
  targetFilter?: Record<string, string>
}

export interface TrendPoint {
  label: string
  value: number
  secondaryValue?: number
}

export interface TopEntityRow {
  id: string
  label: string
  sublabel?: string
  metricLabel: string
  metricValue: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export interface ActivityRow {
  id: string
  title: string
  description: string
  timestamp: string
  tone?: EventLevel
  targetSection?: AdminSection
  targetId?: string
  actor?: string
}

export interface AuditLogRecord {
  id: string
  actor: string
  actorRole: 'admin' | 'user' | 'system'
  actionType: string
  target: string
  targetType?: 'user' | 'provider' | 'model' | 'policy' | 'quota' | 'file' | 'routing' | 'system'
  detail: string
  result: AuditResult
  timestamp: string
  source?: string
  oldValue?: string
  newValue?: string
}

export interface LibraryRecord {
  id: string
  name: string
  ownerId?: string | null
  ownerName: string
  ownerEmail: string
  ownerRole?: 'admin' | 'user' | 'system'
  type: string
  kind: string
  source: string
  sizeLabel: string
  createdAt: string
  status: 'pending' | 'processing' | 'indexed' | 'error' | 'deleted'
  referencedBy: number
  referencedConversations: string[]
  lastReferencedAt: string | null
  scopeType?: 'all' | 'admin' | 'user'
  scopeKey?: string
  scopeLabel?: string
  isSystemMaterial?: boolean
}

export interface LibraryRecordOverride {
  status?: LibraryRecord['status']
  source?: string
  referencedBy?: number
  referencedConversations?: string[]
  lastReferencedAt?: string | null
}

export interface ProviderRegistryItem {
  id: string
  name: string
  type: string
  baseUrl: string
  apiKeyMasked: string
  status: ProviderRuntimeStatus
  enabled: boolean
  visibleToUsers: boolean
  available: boolean
  lastCheckedAt: string | null
  supportedModelCount: number
  requestCount24h: number
  successRate24h: number
  averageLatencyMs: number
  lastErrorReason: string | null
  lastSyncedAt?: string | null
  syncStatus?: string | null
  syncError?: string | null
  externalQuota?: Record<string, unknown> | null
  models: ModelRegistryItem[]
  raw: ManagedProviderConfig
}

export interface ModelFallbackRule {
  condition: 'failure' | 'timeout' | 'quota'
  modelIds: string[]
}

export interface ModelRegistryItem {
  id: string
  displayName: string
  providerId: string
  providerName: string
  type: ModelType
  enabled: boolean
  visibleToUsers: boolean
  allowAutoSelect: boolean
  inputPricePer1k: number
  outputPricePer1k: number
  callPrice: number
  priority: number
  contextWindow: number
  badge?: 'recommended' | 'fast' | 'economy' | 'quality'
  tags: string[]
  description?: string | null
  metadataJson?: Record<string, unknown>
  isHighCost: boolean
  failureRate24h: number
  averageLatencyMs: number
  fallback: ModelFallbackRule
}

export interface RoutingPolicyView {
  userDefaultProvider: string
  userDefaultModel: string
  adminDefaultProvider: string
  adminDefaultModel: string
  allowUserModelSwitch: boolean
  autoRoutingEnabled: boolean
  autoRoutingStrategy: AutoRoutingStrategy
  fallbackModelId: string
}

export interface PlatformQuotaPolicy {
  defaultDailyTokenLimit: number
  defaultMonthlyTokenLimit: number
  defaultModelLimit: number
  defaultRequestLimitDaily: number
  defaultMaxRequestTokens: number
  allowModelSwitching: boolean
  allowAutoModelSelect: boolean
  allowVisualModels: boolean
  allowHighCostModels: boolean
  overageBehavior: QuotaBehavior
  groupDailyTokenLimit?: number
  groupMonthlyTokenLimit?: number
}

export interface BillingTrendRow {
  id: string
  label: string
  tokens: number
  estimatedCost: number
  requestCount: number
}

export interface AdminConsoleLocalState {
  userOverrides: Record<
    string,
    Partial<
      Pick<
        AdminUserRecord,
        | 'status'
        | 'allowedModelIds'
        | 'allowedProviderIds'
        | 'maxSelectableModels'
        | 'autoModelSelectionEnabled'
        | 'tokenQuotaDaily'
        | 'tokenQuotaMonthly'
        | 'allowOverage'
        | 'overageBehavior'
        | 'requestLimitDaily'
        | 'maxRequestTokens'
        | 'canUseVisionModels'
        | 'canUseHighCostModels'
        | 'canUseFeature'
        | 'defaultModelId'
      >
    >
  >
  modelOverrides: Record<
    string,
    Partial<
      Pick<
        ModelRegistryItem,
        | 'visibleToUsers'
        | 'allowAutoSelect'
        | 'inputPricePer1k'
        | 'outputPricePer1k'
        | 'callPrice'
        | 'priority'
        | 'tags'
        | 'fallback'
        | 'enabled'
        | 'isHighCost'
      >
    >
  >
  platformPolicy: PlatformQuotaPolicy
  routingPolicy: Pick<RoutingPolicyView, 'autoRoutingEnabled' | 'autoRoutingStrategy' | 'fallbackModelId'>
  libraryOverrides: Record<string, LibraryRecordOverride>
  auditLogs: AuditLogRecord[]
  localUsers: AdminUserRecord[]
  lastSavedAt?: string | null
}

export interface AdminOverviewSection {
  cards: OverviewMetricCard[]
  requestTrend: TrendPoint[]
  tokenTrend: TrendPoint[]
  activeUserTrend: TrendPoint[]
  topUsers: TopEntityRow[]
  topModels: TopEntityRow[]
  topProviders: TopEntityRow[]
  incidents: ActivityRow[]
  recentRequests: ActivityRow[]
  recentUploads: ActivityRow[]
  recentChanges: AuditLogRecord[]
}

export interface AdminConsoleSnapshot {
  overview: AdminOverviewSection
  users: AdminUserRecord[]
  library: LibraryRecord[]
  providers: ProviderRegistryItem[]
  models: ModelRegistryItem[]
  policies: UserPermissionPolicy
  routing: RoutingPolicyView
  quotas: PlatformQuotaPolicy
  logs: AuditLogRecord[]
  recentActivity: ActivityRow[]
  adminCatalog: AdminProviderCatalog
  billing: {
    byUser: BillingTrendRow[]
    byModel: BillingTrendRow[]
    byProvider: BillingTrendRow[]
    totalCost: number
    totalRevenue: number
  }
}
