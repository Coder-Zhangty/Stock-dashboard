import type { AdminProviderCatalog, ManagedProviderConfig, UserPermissionPolicy } from '../types/chat'
import type {
  ActivityRow,
  AdminConsoleLocalState,
  AdminConsoleSnapshot,
  AdminOverviewSection,
  AdminUserRecord,
  AuditLogRecord,
  BillingTrendRow,
  LibraryRecord,
  ModelFallbackRule,
  ModelRegistryItem,
  OverviewMetricCard,
  PlatformQuotaPolicy,
  ProviderRegistryItem,
  RoutingPolicyView,
  TopEntityRow,
} from '../types/admin'

const STORAGE_KEY = 'aurora_admin_console_state_v2'

const DEFAULT_POLICY: PlatformQuotaPolicy = {
  defaultDailyTokenLimit: 160_000,
  defaultMonthlyTokenLimit: 3_600_000,
  defaultModelLimit: 4,
  defaultRequestLimitDaily: 180,
  defaultMaxRequestTokens: 12_000,
  allowModelSwitching: true,
  allowAutoModelSelect: true,
  allowVisualModels: true,
  allowHighCostModels: false,
  overageBehavior: 'notify',
  groupDailyTokenLimit: 220_000,
  groupMonthlyTokenLimit: 4_200_000,
}

const DEFAULT_STATE: AdminConsoleLocalState = {
  userOverrides: {},
  modelOverrides: {},
  platformPolicy: DEFAULT_POLICY,
  routingPolicy: {
    autoRoutingEnabled: true,
    autoRoutingStrategy: 'quality',
    fallbackModelId: '',
  },
  libraryOverrides: {},
  auditLogs: [],
  localUsers: [],
  lastSavedAt: null,
}

type AdminSnapshotLocale = 'zh-CN' | 'en-US'
type OverviewPayload = Awaited<ReturnType<typeof import('../services/admin').fetchAdminOverview>>

const roundMetric = (value: number, precision = 2) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const formatDelta = (value: number, suffix = '') => {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}${suffix}`
  if (rounded < 0) return `${rounded}${suffix}`
  return `+0${suffix}`
}

const deterministicSeries = (seed: number, count: number, divisor: number, floor: number) => {
  const values: number[] = []
  for (let index = 0; index < count; index += 1) {
    const wave = Math.sin((seed + index * 11) / 8) * 0.18
    const drift = (index / Math.max(count - 1, 1)) * 0.25
    values.push(Math.max(floor, Math.round((seed / divisor) * (0.72 + wave + drift))))
  }
  return values
}

const buildTrend = (labels: string[], primarySeed: number, secondarySeed?: number) => {
  const primary = deterministicSeries(primarySeed, labels.length, labels.length + 3, 1)
  const secondary = secondarySeed ? deterministicSeries(secondarySeed, labels.length, labels.length + 5, 1) : []
  return labels.map((label, index) => ({
    label,
    value: primary[index],
    secondaryValue: secondarySeed ? secondary[index] : undefined,
  }))
}

const buildUserPolicy = (permissions: UserPermissionPolicy) => ({ ...permissions })

const statusFromUser = (user: OverviewPayload['users'][number]) => {
  if (user.status) return user.status as AdminUserRecord['status']
  if (user.disabled) return 'blocked'
  if ((user.tokenUsedMonthly ?? 0) > (user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit) * 0.98)
    return 'suspended'
  return 'active'
}

const maskKeyHint = (provider: ManagedProviderConfig, locale: AdminSnapshotLocale) =>
  provider.apiKeyHint ?? (provider.hasApiKey ? '••••••••' : locale === 'zh-CN' ? '未配置' : 'Not configured')

const providerStatus = (provider: ManagedProviderConfig): ProviderRegistryItem['status'] => {
  if (!provider.enabled) return 'unverified'
  if (provider.available) return 'available'
  return provider.hasApiKey ? 'error' : 'warning'
}

const modelBadgeFor = (label: string, index: number): ModelRegistryItem['badge'] => {
  const lowered = label.toLowerCase()
  if (lowered.includes('plus') || lowered.includes('max')) return 'quality'
  if (lowered.includes('mini') || lowered.includes('turbo')) return 'fast'
  if (index === 0) return 'recommended'
  return 'economy'
}

const modelTypeFor = (label: string): ModelRegistryItem['type'] => {
  const lowered = label.toLowerCase()
  if (lowered.includes('vision') || lowered.includes('vl')) return 'vision'
  if (lowered.includes('embed')) return 'embedding'
  if (lowered.includes('omni') || lowered.includes('audio')) return 'audio'
  if (lowered.includes('image')) return 'image'
  return 'chat'
}

const defaultFallback = (provider: ManagedProviderConfig, modelId: string): ModelFallbackRule => {
  const ids = provider.models.filter((model) => model.id !== modelId).map((model) => model.id)
  return {
    condition: 'failure',
    modelIds: ids.slice(0, 2),
  }
}

const toProviderRegistryItem = (
  provider: ManagedProviderConfig,
  locale: AdminSnapshotLocale,
  activity: OverviewPayload['recentActivity'],
  overrides: AdminConsoleLocalState['modelOverrides'],
): ProviderRegistryItem => {
  const providerRows = activity.filter((item) => item.provider === provider.id)
  const total = providerRows.length || 1
  const failures = Math.round(total * (provider.available ? 0.03 : 0.18))
  const avgLatency = provider.available ? 720 + provider.models.length * 65 : 1430
  const mappedModels = provider.models.map((model, index) => {
    const override = overrides[model.id] ?? {}
    const badge = modelBadgeFor(model.label, index)
    const type = (model.type as ModelRegistryItem['type'] | undefined) ?? modelTypeFor(model.label)
    const inputPricePer1k = override.inputPricePer1k ?? model.inputPricePer1k ?? roundMetric(0.0016 + index * 0.0008, 4)
    const outputPricePer1k = override.outputPricePer1k ?? model.outputPricePer1k ?? roundMetric(0.0044 + index * 0.0011, 4)
    const callPrice = override.callPrice ?? (type === 'image' ? 0.016 : 0)
    const tags =
      override.tags ??
      (model.tags.length > 0 ? model.tags : null) ??
      [
        badge === 'recommended' ? '推荐' : null,
        badge === 'quality' ? '高质量' : null,
        badge === 'fast' ? '快速' : null,
        type === 'vision' ? '视觉' : null,
      ].filter(Boolean) as string[]

    return {
      id: model.id,
      displayName: model.label,
      providerId: provider.id,
      providerName: provider.label || provider.id,
      type,
      enabled: override.enabled ?? (provider.enabled && model.available),
      visibleToUsers: override.visibleToUsers ?? (provider.visibleToUsers && model.enabledForUser),
      allowAutoSelect: override.allowAutoSelect ?? model.allowAutoSelect,
      inputPricePer1k,
      outputPricePer1k,
      callPrice,
      priority: override.priority ?? provider.models.length - index,
      contextWindow: model.contextWindow ?? 32_000 + index * 32_000,
      badge,
      tags,
      description: model.description ?? null,
      metadataJson: model.metadataJson,
      isHighCost: override.isHighCost ?? inputPricePer1k + outputPricePer1k > 0.01,
      failureRate24h: roundMetric(provider.available ? 1.6 + index * 0.9 : 12 + index * 2.1, 1),
      averageLatencyMs: avgLatency + index * 80,
      fallback: override.fallback ?? defaultFallback(provider, model.id),
    } satisfies ModelRegistryItem
  })

  return {
    id: provider.id,
    name: provider.label || provider.id,
    type: provider.id,
    baseUrl: provider.baseUrl,
    apiKeyMasked: maskKeyHint(provider, locale),
    status: providerStatus(provider),
    enabled: provider.enabled,
    visibleToUsers: provider.visibleToUsers,
    available: provider.available,
    lastCheckedAt: provider.lastCheckedAt ?? new Date().toISOString(),
    lastSyncedAt: provider.lastSyncedAt ?? null,
    syncStatus: provider.syncStatus ?? null,
    syncError: provider.syncError ?? null,
    externalQuota: provider.externalQuota ?? null,
    supportedModelCount: provider.models.length,
    requestCount24h: providerRows.length,
    successRate24h: roundMetric(((total - failures) / total) * 100, 1),
    averageLatencyMs: provider.lastPingMs ?? avgLatency,
    lastErrorReason:
      provider.lastErrorReason ??
      (provider.available ? null : locale === 'zh-CN' ? '上游服务返回 401，需要重新验证密钥。' : 'Upstream returned 401 and needs key validation.'),
    models: mappedModels,
    raw: provider,
  }
}

const buildActivity = (id: string, title: string, description: string, timestamp: string, tone?: ActivityRow['tone']) => ({
  id,
  title,
  description,
  timestamp,
  tone,
})

export const readAdminConsoleState = (): AdminConsoleLocalState => {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return {
      ...DEFAULT_STATE,
      ...JSON.parse(raw),
    } as AdminConsoleLocalState
  } catch {
    return DEFAULT_STATE
  }
}

export const writeAdminConsoleState = (state: AdminConsoleLocalState) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const buildLog = (partial: Omit<AuditLogRecord, 'id'>): AuditLogRecord => ({
  id: crypto.randomUUID(),
  ...partial,
})

export const appendAdminLog = (state: AdminConsoleLocalState, partial: Omit<AuditLogRecord, 'id'>) => ({
  ...state,
  auditLogs: [buildLog(partial), ...state.auditLogs].slice(0, 200),
  lastSavedAt: partial.timestamp,
})

const mergeUsers = (
  overview: OverviewPayload,
  permissions: UserPermissionPolicy,
  catalog: AdminProviderCatalog,
  state: AdminConsoleLocalState,
) => {
  const allModels = catalog.providers.flatMap((provider) => provider.models.map((model) => model.id))
  const allProviders = catalog.providers.map((provider) => provider.id)

  const baseUsers: AdminUserRecord[] = overview.users.map((user, index) => {
    const override = state.userOverrides[user.userId] ?? {}
    const monthly = user.tokenUsedMonthly ?? user.totalTokenUsed ?? user.totalTokens
    const totalUsed = user.totalTokenUsed ?? user.totalTokens
    const recentRequests = overview.recentActivity
      .filter((item) => item.userId === user.userId)
      .slice(0, 5)
      .map((item) =>
        buildActivity(
          item.id,
          `${item.model} · ${item.mode}`,
          `${item.promptPreview || (index % 2 === 0 ? '最近一次请求摘要。' : 'Model switch was applied.')} · ${item.totalTokens.toLocaleString()} Token`,
          item.createdAt,
        ),
      )

    const recentUploads = overview.libraryItems
      .filter((item) => item.ownerId === user.userId)
      .slice(0, 4)
      .map((item) =>
        buildActivity(
          item.id,
          item.name,
          `${item.type} · ${item.sizeLabel}`,
          item.createdAt,
        ),
      )

    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: override.status ?? statusFromUser(user),
      createdAt: user.createdAt,
      accountType: user.accountType,
      requestCount: user.requestCount,
      promptTokens: user.promptTokens,
      completionTokens: user.completionTokens,
      totalTokens: user.totalTokens,
      tokenQuotaDaily: override.tokenQuotaDaily ?? user.tokenQuotaDaily ?? DEFAULT_POLICY.defaultDailyTokenLimit,
      tokenQuotaMonthly: override.tokenQuotaMonthly ?? user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit,
      tokenUsedDaily: user.tokenUsedDaily ?? Math.round(totalUsed * 0.08),
      tokenUsedWeekly: user.tokenUsedWeekly ?? Math.round(totalUsed * 0.28),
      tokenUsedMonthly: monthly,
      totalTokenUsed: totalUsed,
      libraryCount: user.libraryCount,
      lastActiveAt: user.lastActiveAt,
      lastLoginAt: user.lastLoginAt ?? user.lastActiveAt,
      lastModel: user.lastModel,
      allowedModelIds: override.allowedModelIds ?? user.allowedModelIds ?? allModels,
      allowedProviderIds: override.allowedProviderIds ?? user.allowedProviderIds ?? allProviders,
      maxSelectableModels: override.maxSelectableModels ?? user.maxSelectableModels ?? DEFAULT_POLICY.defaultModelLimit,
      autoModelSelectionEnabled:
        override.autoModelSelectionEnabled ?? user.autoModelSelectionEnabled ?? DEFAULT_POLICY.allowAutoModelSelect,
      allowOverage: override.allowOverage ?? user.allowOverage ?? false,
      overageBehavior: override.overageBehavior ?? user.overageBehavior ?? DEFAULT_POLICY.overageBehavior,
      requestLimitDaily: override.requestLimitDaily ?? user.requestLimitDaily ?? DEFAULT_POLICY.defaultRequestLimitDaily,
      maxRequestTokens: override.maxRequestTokens ?? user.maxRequestTokens ?? DEFAULT_POLICY.defaultMaxRequestTokens,
      estimatedCostMonthly: user.estimatedCostMonthly,
      estimatedCostLifetime: roundMetric((totalUsed / 1000) * 0.0086, 2),
      canUseVisionModels: override.canUseVisionModels ?? user.canUseVisionModels,
      canUseHighCostModels: override.canUseHighCostModels ?? user.canUseHighCostModels,
      canUseFeature: override.canUseFeature ?? user.canUseFeature ?? buildUserPolicy(permissions),
      overQuota: monthly > (override.tokenQuotaMonthly ?? user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit),
      passwordResetRequired: false,
      defaultModelId: override.defaultModelId ?? user.allowedModelIds?.[0] ?? catalog.managedRouting.userDefaultModel,
      recentRequests,
      recentUploads,
      recentEvents: [
        buildActivity(
          `quota-${user.userId}`,
          monthly > (override.tokenQuotaMonthly ?? user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit)
            ? 'Quota alert'
            : 'Usage baseline',
          monthly > (override.tokenQuotaMonthly ?? user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit)
            ? 'Monthly quota reached'
            : 'Usage remains within baseline',
          user.lastActiveAt ?? user.createdAt,
          monthly > (override.tokenQuotaMonthly ?? user.tokenQuotaMonthly ?? DEFAULT_POLICY.defaultMonthlyTokenLimit)
            ? 'warning'
            : 'info',
        ),
      ],
      recentModelSwitches: recentRequests.slice(0, 3),
      isLocalOnly: false,
    }
  })

  return [...state.localUsers, ...baseUsers]
}

const topRowsFromMap = (
  input: Map<string, { label: string; count: number; sublabel?: string }>,
  metricLabel: string,
): TopEntityRow[] =>
  [...input.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 6)
    .map(([id, value]) => ({
      id,
      label: value.label,
      sublabel: value.sublabel,
      metricLabel,
      metricValue: value.count.toLocaleString(),
    }))

const buildOverviewCards = (
  users: AdminUserRecord[],
  models: ModelRegistryItem[],
  providers: ProviderRegistryItem[],
  library: LibraryRecord[],
  locale: AdminSnapshotLocale,
  previous?: {
    userCount: number
    active24h: number
    requests: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    modelCount: number
    providerCount: number
    libraryCount: number
    successRate: number
    averageLatency: number
    estimatedMonthlyCost: number
  } | null,
): OverviewMetricCard[] => {
  const isZh = locale === 'zh-CN'
  const active24h = users.filter((user) => user.lastActiveAt).length
  const requests = users.reduce((sum, user) => sum + user.requestCount, 0)
  const todayPrompt = users.reduce((sum, user) => sum + user.promptTokens, 0)
  const todayCompletion = users.reduce((sum, user) => sum + user.completionTokens, 0)
  const totalTokens = users.reduce((sum, user) => sum + user.totalTokenUsed, 0)
  const overQuota = users.filter((user) => user.overQuota).length
  const highCostModels = models.filter((model) => model.isHighCost).length
  const totalProviderRequests = providers.reduce((sum, provider) => sum + provider.requestCount24h, 0)
  const weightedSuccess = providers.reduce(
    (sum, provider) => sum + provider.successRate24h * Math.max(provider.requestCount24h, 1),
    0,
  )
  const weightedLatency = providers.reduce(
    (sum, provider) => sum + provider.averageLatencyMs * Math.max(provider.requestCount24h, 1),
    0,
  )
  const successRate =
    providers.length > 0 ? Math.round(weightedSuccess / Math.max(totalProviderRequests || providers.length, 1)) : 0
  const averageLatency = Math.round(weightedLatency / Math.max(totalProviderRequests || providers.length, 1))
  const estimatedMonthlyCost = users.reduce((sum, user) => sum + user.estimatedCostMonthly, 0)

  return [
    {
      id: 'users',
      label: isZh ? '总用户数' : 'Total users',
      value: String(users.length),
      change: formatDelta(users.length - (previous?.userCount ?? users.length)),
      targetSection: 'users',
    },
    {
      id: 'active',
      label: isZh ? '活跃用户（24h）' : 'Active users (24h)',
      value: String(active24h),
      change: formatDelta(active24h - (previous?.active24h ?? active24h)),
      tone: active24h >= (previous?.active24h ?? active24h) ? 'success' : undefined,
      targetSection: 'users',
      targetFilter: { recent: '24h' },
    },
    {
      id: 'requests',
      label: isZh ? '今日请求数' : 'Requests today',
      value: String(requests),
      change: formatDelta(requests - (previous?.requests ?? requests)),
    },
    {
      id: 'prompt',
      label: isZh ? '今日输入 Token' : 'Input tokens today',
      value: todayPrompt.toLocaleString(),
      change: formatDelta(todayPrompt - (previous?.promptTokens ?? todayPrompt)),
      targetSection: 'quotas',
      targetFilter: { range: 'today', metric: 'input' },
    },
    {
      id: 'completion',
      label: isZh ? '今日输出 Token' : 'Output tokens today',
      value: todayCompletion.toLocaleString(),
      change: formatDelta(todayCompletion - (previous?.completionTokens ?? todayCompletion)),
      targetSection: 'quotas',
      targetFilter: { range: 'today', metric: 'output' },
    },
    {
      id: 'month',
      label: isZh ? '本月 Token 量' : 'Monthly token volume',
      value: totalTokens.toLocaleString(),
      change: formatDelta(totalTokens - (previous?.totalTokens ?? totalTokens)),
      targetSection: 'quotas',
      targetFilter: { range: '30d' },
    },
    {
      id: 'models',
      label: isZh ? '已托管模型数' : 'Hosted models',
      value: String(models.length),
      change: formatDelta(models.length - (previous?.modelCount ?? models.length)),
      targetSection: 'models',
    },
    {
      id: 'providers',
      label: isZh ? '服务商数量' : 'Providers',
      value: String(providers.length),
      change: formatDelta(providers.length - (previous?.providerCount ?? providers.length)),
      targetSection: 'models',
    },
    {
      id: 'library',
      label: isZh ? '资料库文件数' : 'Library files',
      value: String(library.length),
      change: formatDelta(library.length - (previous?.libraryCount ?? library.length)),
      tone: overQuota ? 'warning' : 'default',
      targetSection: 'library',
    },
    {
      id: 'success-rate',
      label: isZh ? '24h 成功率' : '24h success rate',
      value: `${successRate}%`,
      change: formatDelta(successRate - (previous?.successRate ?? successRate), '%'),
      tone: successRate >= (previous?.successRate ?? successRate) ? 'success' : undefined,
      targetSection: 'system',
    },
    {
      id: 'latency',
      label: isZh ? '平均响应时间' : 'Average latency',
      value: `${averageLatency}ms`,
      change: formatDelta(averageLatency - (previous?.averageLatency ?? averageLatency), 'ms'),
      targetSection: 'system',
    },
    {
      id: 'cost',
      label: isZh ? '本月预估成本' : 'Estimated monthly cost',
      value: `$${roundMetric(estimatedMonthlyCost, 2).toLocaleString()}`,
      change: formatDelta(roundMetric(estimatedMonthlyCost - (previous?.estimatedMonthlyCost ?? estimatedMonthlyCost), 2)),
      tone: highCostModels ? 'warning' : 'default',
      targetSection: 'quotas',
      targetFilter: { range: '30d', metric: 'cost' },
    },
  ]
}

const normalizeSource = (source: string, isZh: boolean) => {
  if (!isZh) return source
  return {
    user_upload: '用户上传',
    admin_upload: '管理员导入',
    import: '导入',
  }[source] ?? source
}

export const buildAdminConsoleSnapshot = (
  overview: OverviewPayload,
  adminCatalog: AdminProviderCatalog,
  state: AdminConsoleLocalState,
  locale: AdminSnapshotLocale = 'en-US',
  previousOverview?: OverviewPayload | null,
  previousCatalog?: AdminProviderCatalog | null,
): AdminConsoleSnapshot => {
  const isZh = locale === 'zh-CN'
  const providers = adminCatalog.providers.map((provider) =>
    toProviderRegistryItem(provider, locale, overview.recentActivity, state.modelOverrides),
  )
  const models = providers.flatMap((provider) => provider.models)
  const users = mergeUsers(overview, adminCatalog.permissions, adminCatalog, state)
  const previousProviders =
    previousCatalog?.providers.map((provider) =>
      toProviderRegistryItem(provider, locale, previousOverview?.recentActivity ?? [], state.modelOverrides),
    ) ?? null
  const previousModels = previousProviders?.flatMap((provider) => provider.models) ?? null
  const previousUsers =
    previousOverview && previousCatalog
      ? mergeUsers(previousOverview, previousCatalog.permissions, previousCatalog, state)
      : null

  const baseLibrary: LibraryRecord[] = overview.libraryItems.map((item, index) => ({
    id: item.id,
    name: item.name,
    ownerName: item.ownerName ?? (isZh ? '未知用户' : 'Unknown owner'),
    ownerEmail: item.ownerEmail ?? 'unknown@aurora.local',
    type: item.type,
    kind: item.kind,
    source: normalizeSource(item.source, isZh),
    sizeLabel: item.sizeLabel,
    createdAt: item.createdAt,
    status: index % 13 === 0 ? 'error' : index % 7 === 0 ? 'processing' : 'indexed',
    referencedBy: (index % 5) + 1,
    referencedConversations: [`conv-${index + 1}`, `conv-${index + 2}`].slice(0, (index % 2) + 1),
    lastReferencedAt: index % 4 === 0 ? item.createdAt : new Date(Date.now() - index * 86400000).toISOString(),
  }))

  const library: LibraryRecord[] = baseLibrary.map((item) => {
    const override = state.libraryOverrides[item.id] ?? {}

    return {
      ...item,
      source: override.source ?? item.source,
      status: override.status ?? item.status,
      referencedBy: override.referencedBy ?? item.referencedBy,
      referencedConversations: override.referencedConversations ?? item.referencedConversations,
      lastReferencedAt: override.lastReferencedAt ?? item.lastReferencedAt,
    }
  })

  const routing: RoutingPolicyView = {
    userDefaultProvider: adminCatalog.managedRouting.userDefaultProvider,
    userDefaultModel: adminCatalog.managedRouting.userDefaultModel,
    adminDefaultProvider: adminCatalog.managedRouting.adminDefaultProvider,
    adminDefaultModel: adminCatalog.managedRouting.adminDefaultModel,
    allowUserModelSwitch: adminCatalog.managedRouting.allowUserModelSwitch,
    autoRoutingEnabled: state.routingPolicy.autoRoutingEnabled,
    autoRoutingStrategy: state.routingPolicy.autoRoutingStrategy,
    fallbackModelId: state.routingPolicy.fallbackModelId || adminCatalog.managedRouting.userDefaultModel,
  }

  const recentActivity: ActivityRow[] = overview.recentActivity
    .slice(0, 12)
    .map((item, index): ActivityRow => ({
    id: item.id,
    title: isZh ? `${item.userName} 调用了 ${item.model}` : `${item.userName} used ${item.model}`,
    description: isZh
      ? `${item.totalTokens.toLocaleString()} Token · ${item.mode}`
      : `${item.totalTokens.toLocaleString()} tokens · ${item.mode}`,
    timestamp: item.createdAt,
    tone: index % 6 === 0 ? 'warning' : 'info',
    targetSection: 'users',
    targetId: item.userId ?? undefined,
    }))

  const topUsers = [...users]
    .sort((left, right) => right.totalTokenUsed - left.totalTokenUsed)
    .slice(0, 5)
    .map((user) => ({
      id: user.userId,
      label: user.name,
      sublabel: user.email,
      metricLabel: isZh ? 'Token 用量' : 'Token usage',
      metricValue: user.totalTokenUsed.toLocaleString(),
    }))

  const modelMap = new Map<string, { label: string; count: number }>()
  const providerMap = new Map<string, { label: string; count: number }>()
  overview.recentActivity.forEach((item) => {
    modelMap.set(item.model, {
      label: item.model,
      count: (modelMap.get(item.model)?.count ?? 0) + item.totalTokens,
    })
    providerMap.set(item.provider, {
      label: item.provider,
      count: (providerMap.get(item.provider)?.count ?? 0) + item.totalTokens,
    })
  })

  const incidents: ActivityRow[] = [
    ...providers
      .filter((provider) => provider.status !== 'available')
      .map((provider): ActivityRow => ({
        id: `provider-${provider.id}`,
        title: isZh ? `${provider.name} 健康检查异常` : `${provider.name} health degraded`,
        description: provider.lastErrorReason ?? (isZh ? '服务商状态需要处理。' : 'Provider state requires attention.'),
        timestamp: provider.lastCheckedAt ?? new Date().toISOString(),
        tone: provider.status === 'error' ? 'critical' : 'warning',
        targetSection: 'models',
        targetId: provider.id,
      })),
    ...users
      .filter((user) => user.overQuota)
      .slice(0, 3)
      .map((user): ActivityRow => ({
        id: `quota-${user.userId}`,
        title: isZh ? `${user.name} 已超出配额` : `${user.name} exceeded quota`,
        description: isZh
          ? `已使用 ${user.tokenUsedMonthly.toLocaleString()} / ${user.tokenQuotaMonthly.toLocaleString()} Token`
          : `${user.tokenUsedMonthly.toLocaleString()} / ${user.tokenQuotaMonthly.toLocaleString()} tokens used`,
        timestamp: user.lastActiveAt ?? user.createdAt,
        tone: 'warning',
        targetSection: 'users',
        targetId: user.userId,
      })),
    {
      id: 'routing-change',
      title: isZh ? '自动回退策略已生效' : 'Fallback strategy updated',
      description: isZh
        ? `主模型失败后将自动回退到 ${routing.fallbackModelId}。`
        : `Primary model now falls back to ${routing.fallbackModelId}.`,
      timestamp: state.lastSavedAt ?? new Date().toISOString(),
      tone: 'info',
      targetSection: 'models',
    } satisfies ActivityRow,
  ]

  const overviewSection: AdminOverviewSection = {
    cards: buildOverviewCards(
      users,
      models,
      providers,
      library,
      locale,
      previousUsers && previousModels && previousProviders && previousOverview
        ? {
            userCount: previousUsers.length,
            active24h: previousUsers.filter((user) => user.lastActiveAt).length,
            requests: previousUsers.reduce((sum, user) => sum + user.requestCount, 0),
            promptTokens: previousUsers.reduce((sum, user) => sum + user.promptTokens, 0),
            completionTokens: previousUsers.reduce((sum, user) => sum + user.completionTokens, 0),
            totalTokens: previousUsers.reduce((sum, user) => sum + user.totalTokenUsed, 0),
            modelCount: previousModels.length,
            providerCount: previousProviders.length,
            libraryCount: previousOverview.libraryItems.length,
            successRate:
              previousProviders.length > 0
                ? Math.round(
                    previousProviders.reduce(
                      (sum, provider) =>
                        sum + provider.successRate24h * Math.max(provider.requestCount24h, 1),
                      0,
                    ) /
                      Math.max(
                        previousProviders.reduce((sum, provider) => sum + provider.requestCount24h, 0) ||
                          previousProviders.length,
                        1,
                      ),
                  )
                : 0,
            averageLatency:
              previousProviders.length > 0
                ? Math.round(
                    previousProviders.reduce(
                      (sum, provider) =>
                        sum + provider.averageLatencyMs * Math.max(provider.requestCount24h, 1),
                      0,
                    ) /
                      Math.max(
                        previousProviders.reduce((sum, provider) => sum + provider.requestCount24h, 0) ||
                          previousProviders.length,
                        1,
                      ),
                  )
                : 0,
            estimatedMonthlyCost: previousUsers.reduce((sum, user) => sum + user.estimatedCostMonthly, 0),
          }
        : null,
    ),
    requestTrend: buildTrend(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], overview.system.requestCount + 10, overview.system.requestCount + 6),
    tokenTrend: buildTrend(['W1', 'W2', 'W3', 'W4'], overview.system.totalTokens + 7000, overview.system.promptTokens + 4000),
    activeUserTrend: buildTrend(['7d', '6d', '5d', '4d', '3d', '2d', '1d'], overview.system.activeUserCount + 6),
    topUsers,
    topModels: topRowsFromMap(modelMap, isZh ? 'Token 负载' : 'Token load'),
    topProviders: topRowsFromMap(providerMap, isZh ? 'Token 负载' : 'Token load'),
    incidents,
    recentRequests: recentActivity.slice(0, 8),
    recentUploads: library.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.name,
      description: `${item.ownerName} · ${item.type} · ${item.sizeLabel}`,
      timestamp: item.createdAt,
      targetSection: 'library',
      targetId: item.id,
    })),
    recentChanges: state.auditLogs.slice(0, 8),
  }

  const billingByUser: BillingTrendRow[] = users
    .map((user) => ({
      id: user.userId,
      label: user.name,
      tokens: user.totalTokenUsed,
      estimatedCost: user.estimatedCostMonthly,
      requestCount: user.requestCount,
    }))
    .sort((left, right) => right.tokens - left.tokens)

  const billingByModel: BillingTrendRow[] = models
    .map((model) => {
      const tokenLoad = overview.recentActivity
        .filter((item) => item.model === model.id || item.model === model.displayName)
        .reduce((sum, item) => sum + item.totalTokens, 0)
      return {
        id: model.id,
        label: model.displayName,
        tokens: tokenLoad,
        estimatedCost: roundMetric((tokenLoad / 1000) * (model.inputPricePer1k + model.outputPricePer1k), 2),
        requestCount: overview.recentActivity.filter((item) => item.model === model.id || item.model === model.displayName).length,
      }
    })
    .sort((left, right) => right.tokens - left.tokens)

  const billingByProvider: BillingTrendRow[] = providers
    .map((provider) => {
      const rows = overview.recentActivity.filter((item) => item.provider === provider.id)
      const tokens = rows.reduce((sum, item) => sum + item.totalTokens, 0)
      return {
        id: provider.id,
        label: provider.name,
        tokens,
        estimatedCost: roundMetric(tokens / 1000 / 4.2, 2),
        requestCount: rows.length,
      }
    })
    .sort((left, right) => right.tokens - left.tokens)

  return {
    overview: overviewSection,
    users,
    library,
    providers,
    models,
    policies: adminCatalog.permissions,
    routing,
    quotas: state.platformPolicy,
    logs: state.auditLogs,
    recentActivity,
    adminCatalog,
    billing: {
      byUser: billingByUser,
      byModel: billingByModel,
      byProvider: billingByProvider,
      totalCost: roundMetric(billingByProvider.reduce((sum, item) => sum + item.estimatedCost, 0), 2),
      totalRevenue: roundMetric(billingByUser.reduce((sum, item) => sum + item.estimatedCost, 0) * 1.34, 2),
    },
  }
}

export const createUserSeed = (
  input: { name: string; email: string; role: 'admin' | 'user' },
  permissions: UserPermissionPolicy,
  catalog: AdminProviderCatalog,
): AdminUserRecord => {
  const providerIds = catalog.providers.filter((provider) => provider.visibleToUsers).map((provider) => provider.id)
  const modelIds = catalog.providers.flatMap((provider) =>
    provider.models.filter((model) => model.enabledForUser).map((model) => model.id),
  )
  const now = new Date().toISOString()
  return {
    userId: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    role: input.role,
    status: 'pending',
    createdAt: now,
    accountType: input.role,
    requestCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    tokenQuotaDaily: DEFAULT_POLICY.defaultDailyTokenLimit,
    tokenQuotaMonthly: DEFAULT_POLICY.defaultMonthlyTokenLimit,
    tokenUsedDaily: 0,
    tokenUsedWeekly: 0,
    tokenUsedMonthly: 0,
    totalTokenUsed: 0,
    libraryCount: 0,
    lastActiveAt: null,
    lastLoginAt: null,
    lastModel: null,
    allowedModelIds: modelIds,
    allowedProviderIds: providerIds,
    maxSelectableModels: DEFAULT_POLICY.defaultModelLimit,
    autoModelSelectionEnabled: DEFAULT_POLICY.allowAutoModelSelect,
    allowOverage: false,
    overageBehavior: DEFAULT_POLICY.overageBehavior,
    requestLimitDaily: DEFAULT_POLICY.defaultRequestLimitDaily,
    maxRequestTokens: DEFAULT_POLICY.defaultMaxRequestTokens,
    estimatedCostMonthly: 0,
    estimatedCostLifetime: 0,
    canUseVisionModels: DEFAULT_POLICY.allowVisualModels,
    canUseHighCostModels: DEFAULT_POLICY.allowHighCostModels,
    canUseFeature: permissions,
    overQuota: false,
    passwordResetRequired: true,
    defaultModelId: catalog.managedRouting.userDefaultModel,
    recentRequests: [],
    recentUploads: [],
    recentEvents: [],
    recentModelSwitches: [],
    isLocalOnly: true,
  }
}
