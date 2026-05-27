import { Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'
import type { ModelRegistryItem, ProviderRegistryItem, RoutingPolicyView } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface ModelsPanelProps {
  providers: ProviderRegistryItem[]
  models: ModelRegistryItem[]
  routing: RoutingPolicyView
  activeProviderId: string
  onActiveProviderChange: (providerId: string) => void
  onCreateProvider: () => void
  onCreateModel: (providerId: string) => void
  onProviderPatch: (providerId: string, patch: Partial<ProviderRegistryItem['raw']>) => void
  onModelPatch: (modelId: string, patch: Partial<ModelRegistryItem>) => void
  onRoutingPatch: (patch: Partial<RoutingPolicyView>) => void
  onTestProvider: (providerId: string) => void | Promise<void>
  onSyncProvider: (providerId: string) => void | Promise<void>
  onDeleteProvider: (provider: ProviderRegistryItem) => void
  onDeleteModel: (model: ModelRegistryItem) => void
  testingProviderId?: string | null
  syncingProviderId?: string | null
  providerTestResult?: {
    providerId: string
    detail: string
    latencyMs?: number | null
    checkedAt?: string | null
  } | null
  onRestoreRouting: () => void
  onSaveProviderConfig: (providerId: string) => void
}

const badgeTone = (badge: ModelRegistryItem['badge']) => {
  if (badge === 'quality') return 'info'
  if (badge === 'fast') return 'success'
  if (badge === 'economy') return 'warning'
  return 'default'
}

const statusTone = (status: ProviderRegistryItem['status']) =>
  status === 'available' ? 'success' : status === 'error' ? 'danger' : status === 'warning' ? 'warning' : 'default'

const modelTypeLabel = (type: ModelRegistryItem['type'], isZh: boolean) => {
  if (!isZh) return type
  if (type === 'chat') return '对话'
  if (type === 'vision') return '视觉'
  if (type === 'embedding') return '向量'
  return '图像'
}

const providerStatusLabel = (status: ProviderRegistryItem['status'], isZh: boolean) => {
  if (!isZh) return status
  if (status === 'available') return '可用'
  if (status === 'error') return '错误'
  if (status === 'warning') return '告警'
  return '未验证'
}

const badgeLabel = (badge: ModelRegistryItem['badge'], isZh: boolean) => {
  if (!badge) return ''
  if (!isZh) return badge
  if (badge === 'recommended') return '推荐'
  if (badge === 'quality') return '高质量'
  if (badge === 'fast') return '快速'
  return '低成本'
}

const modelSourceLabel = (model: ModelRegistryItem, isZh: boolean) => {
  const source = String(model.metadataJson?.source ?? 'manual')
  if (!isZh) return source.replaceAll('_', ' ')
  if (source === 'official_api') return '官方接口'
  if (source === 'official_docs_seed') return '官方文档'
  if (source === 'curated_seed') return '内置目录'
  return '手动'
}

export const ModelsPanel = ({
  providers,
  models,
  routing,
  activeProviderId,
  onActiveProviderChange,
  onCreateProvider,
  onCreateModel,
  onProviderPatch,
  onModelPatch,
  onRoutingPatch,
  onTestProvider,
  onSyncProvider,
  onDeleteProvider,
  onDeleteModel,
  testingProviderId,
  syncingProviderId,
  providerTestResult,
  onRestoreRouting,
  onSaveProviderConfig,
}: ModelsPanelProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0]
  const providerModels = models.filter((model) => model.providerId === activeProvider?.id)
  const activeTestResult = providerTestResult?.providerId === activeProvider?.id ? providerTestResult : null

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '路由与默认策略' : 'Routing policy'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isZh
                ? '管理普通用户/管理员默认模型、自动选模策略和失败回退链。'
                : 'Manage default models, auto selection strategy, and fallback chain.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRestoreRouting}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink"
            >
              <RotateCcw size={14} />
              {isZh ? '恢复默认' : 'Restore defaults'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {[
            ['普通用户默认模型', 'Default user model', 'userDefaultModel'],
            ['管理员默认模型', 'Default admin model', 'adminDefaultModel'],
            ['普通用户默认服务商', 'Default user provider', 'userDefaultProvider'],
            ['管理员默认服务商', 'Default admin provider', 'adminDefaultProvider'],
          ].map(([zh, en, key]) => (
            <label key={key} className="rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? zh : en}</span>
              <select
                value={routing[key as keyof RoutingPolicyView] as string}
                onChange={(event) => onRoutingPatch({ [key]: event.target.value } as Partial<RoutingPolicyView>)}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                {(key.includes('Provider') ? providers : models).map((item) => (
                  <option key={item.id} value={item.id}>
                    {'name' in item ? item.name : item.displayName}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
            <span>{isZh ? '允许普通用户切换模型' : 'Allow user model switching'}</span>
            <input
              type="checkbox"
              checked={routing.allowUserModelSwitch}
              onChange={(event) => onRoutingPatch({ allowUserModelSwitch: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
            <span>{isZh ? '开启自动选模' : 'Enable auto routing'}</span>
            <input
              type="checkbox"
              checked={routing.autoRoutingEnabled}
              onChange={(event) => onRoutingPatch({ autoRoutingEnabled: event.target.checked })}
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">
              {isZh ? '自动选模策略' : 'Auto routing strategy'}
            </span>
            <select
              value={routing.autoRoutingStrategy}
              onChange={(event) =>
                onRoutingPatch({ autoRoutingStrategy: event.target.value as RoutingPolicyView['autoRoutingStrategy'] })
              }
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="cost">{isZh ? '低成本优先' : 'Low cost first'}</option>
              <option value="quality">{isZh ? '效果优先' : 'High quality first'}</option>
              <option value="latency">{isZh ? '低延迟优先' : 'Low latency first'}</option>
            </select>
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">
              {isZh ? '全局 fallback 模型' : 'Fallback model'}
            </span>
            <select
              value={routing.fallbackModelId}
              onChange={(event) => onRoutingPatch({ fallbackModelId: event.target.value })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '服务商' : 'Providers'}</h3>
            <button
              type="button"
              onClick={onCreateProvider}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs text-muted transition hover:text-ink"
            >
              <Plus size={14} />
              {isZh ? '新增' : 'Add'}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => onActiveProviderChange(provider.id)}
                className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                  activeProvider?.id === provider.id
                    ? 'border-[#111827] bg-[#111827] text-white'
                    : 'border-slate-200 bg-white text-ink hover:bg-[#fafbfd]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-5">{provider.name}</p>
                    <p
                      className={`mt-1 break-all text-[11px] leading-5 ${
                        activeProvider?.id === provider.id ? 'text-white/70' : 'text-subtle'
                      }`}
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {provider.baseUrl}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(provider.status)}>
                    {providerStatusLabel(provider.status, isZh)}
                  </StatusBadge>
                </div>

                <div
                  className={`mt-4 grid grid-cols-3 gap-2 text-xs ${
                    activeProvider?.id === provider.id ? 'text-white/75' : 'text-subtle'
                  }`}
                >
                  <div>
                    <p>{isZh ? '24h 请求' : '24h req'}</p>
                    <p className="mt-1 font-medium">{provider.requestCount24h}</p>
                  </div>
                  <div>
                    <p>{isZh ? '成功率' : 'Success'}</p>
                    <p className="mt-1 font-medium">{provider.successRate24h}%</p>
                  </div>
                  <div>
                    <p>{isZh ? '延迟' : 'Latency'}</p>
                    <p className="mt-1 font-medium">{provider.averageLatencyMs}ms</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          {activeProvider ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-ink">{activeProvider.name}</h3>
                    <StatusBadge tone={statusTone(activeProvider.status)}>
                      {providerStatusLabel(activeProvider.status, isZh)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {isZh
                      ? '查看健康状态、请求成功率、接口配置和下游模型列表。'
                      : 'Inspect health, request success, provider configuration, and downstream models.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCreateModel(activeProvider.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink"
                  >
                    <Plus size={14} />
                    {isZh ? '新增模型' : 'Add model'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTestProvider(activeProvider.id)}
                    disabled={testingProviderId === activeProvider.id}
                    className="rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testingProviderId === activeProvider.id
                      ? isZh
                        ? '测试中...'
                        : 'Testing...'
                      : isZh
                        ? '测试连通性'
                        : 'Test connection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onProviderPatch(activeProvider.id, { enabled: !activeProvider.raw.enabled })}
                    className="rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink"
                  >
                    {isZh ? (activeProvider.enabled ? '停用服务商' : '启用服务商') : activeProvider.enabled ? 'Disable provider' : 'Enable provider'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSyncProvider(activeProvider.id)}
                    disabled={syncingProviderId === activeProvider.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={syncingProviderId === activeProvider.id ? 'animate-spin' : ''} />
                    {syncingProviderId === activeProvider.id
                      ? isZh
                        ? '同步中...'
                        : 'Syncing...'
                      : isZh
                        ? '从官网拉取'
                        : 'Sync catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProvider(activeProvider)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                    {isZh ? '删除服务商' : 'Delete provider'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveProviderConfig(activeProvider.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a]"
                  >
                    <Save size={14} />
                    {isZh ? '保存配置' : 'Save config'}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
                <span>
                  {isZh ? '最近探测' : 'Last probe'}：
                  {activeProvider.lastCheckedAt ? new Date(activeProvider.lastCheckedAt).toLocaleString() : isZh ? '未测试' : 'Not tested'}
                </span>
                <span>
                  Ping：
                  {typeof activeProvider.averageLatencyMs === 'number' ? `${activeProvider.averageLatencyMs}ms` : '—'}
                </span>
                {activeTestResult ? (
                  <span className={activeProvider.status === 'available' ? 'text-emerald-600' : 'text-amber-600'}>
                    {activeTestResult.detail}
                  </span>
                ) : null}
                {activeProvider.lastSyncedAt ? (
                  <span>
                    {isZh ? '最近同步' : 'Last sync'}：
                    {new Date(activeProvider.lastSyncedAt).toLocaleString()}
                  </span>
                ) : null}
                {activeProvider.syncError ? <span className="text-amber-600">{activeProvider.syncError}</span> : null}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-4">
                {[
                  [isZh ? '最近健康检查' : 'Last health check', activeProvider.lastCheckedAt ? new Date(activeProvider.lastCheckedAt).toLocaleString() : '—'],
                  [isZh ? '24h 请求数' : '24h requests', String(activeProvider.requestCount24h)],
                  [isZh ? '24h 成功率' : '24h success rate', `${activeProvider.successRate24h}%`],
                  [isZh ? '平均响应时间' : 'Average latency', `${activeProvider.averageLatencyMs}ms`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
                    <p className="mt-2 text-base font-semibold text-ink">{value}</p>
                  </div>
                ))}
              </div>

              {activeProvider.lastErrorReason ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {activeProvider.lastErrorReason}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <label className="rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">Base URL</span>
                  <input
                    value={activeProvider.raw.baseUrl}
                    onChange={(event) => onProviderPatch(activeProvider.id, { baseUrl: event.target.value })}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                  />
                </label>
                <label className="rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                    {isZh ? '运行模型' : 'Runtime model'}
                  </span>
                  <select
                    value={activeProvider.raw.configuredModel || providerModels[0]?.id || ''}
                    onChange={(event) => onProviderPatch(activeProvider.id, { configuredModel: event.target.value })}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    {providerModels.length === 0 ? (
                      <option value="">{isZh ? '请先同步或新增模型' : 'Sync or add models first'}</option>
                    ) : null}
                    {providerModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName} ({model.id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">API key</span>
                  <input
                    value={activeProvider.raw.apiKeyInput ?? ''}
                    onChange={(event) => onProviderPatch(activeProvider.id, { apiKeyInput: event.target.value, clearApiKey: false })}
                    placeholder={activeProvider.apiKeyMasked}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={activeProvider.raw.enabled}
                    onChange={(event) => onProviderPatch(activeProvider.id, { enabled: event.target.checked })}
                  />
                  {isZh ? '启用服务商' : 'Enable provider'}
                </label>
                <label className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={activeProvider.raw.visibleToUsers}
                    onChange={(event) => onProviderPatch(activeProvider.id, { visibleToUsers: event.target.checked })}
                  />
                  {isZh ? '对普通用户可见' : 'Visible to users'}
                </label>
              </div>

              <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
                <div className="grid grid-cols-[1.4fr_90px_95px_95px_110px_110px_120px_1.2fr_80px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
                  <span>{isZh ? '模型' : 'Model'}</span>
                  <span>{isZh ? '类型' : 'Type'}</span>
                  <span>{isZh ? '状态' : 'Status'}</span>
                  <span>{isZh ? '用户可见' : 'Visible'}</span>
                  <span>{isZh ? '自动选模' : 'Auto'}</span>
                  <span>{isZh ? '高成本' : 'High cost'}</span>
                  <span>{isZh ? '价格' : 'Pricing'}</span>
                  <span>Fallback</span>
                  <span>{isZh ? '操作' : 'Actions'}</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {providerModels.map((model) => (
                    <div
                      key={model.id}
                      className="grid grid-cols-[1.4fr_90px_95px_95px_110px_110px_120px_1.2fr_80px] gap-4 px-4 py-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-ink">{model.displayName}</p>
                          {model.badge ? (
                            <StatusBadge tone={badgeTone(model.badge)}>
                              {badgeLabel(model.badge, isZh)}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge tone="default">
                            {modelSourceLabel(model, isZh)}
                          </StatusBadge>
                          {model.tags.map((tag) => (
                            <StatusBadge key={tag} tone="default">
                              {tag}
                            </StatusBadge>
                          ))}
                        </div>
                      </div>
                      <p className="text-muted">{modelTypeLabel(model.type, isZh)}</p>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={model.enabled}
                          onChange={(event) => onModelPatch(model.id, { enabled: event.target.checked })}
                        />
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={model.visibleToUsers}
                          onChange={(event) => onModelPatch(model.id, { visibleToUsers: event.target.checked })}
                        />
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={model.allowAutoSelect}
                          onChange={(event) => onModelPatch(model.id, { allowAutoSelect: event.target.checked })}
                        />
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={model.isHighCost}
                          onChange={(event) => onModelPatch(model.id, { isHighCost: event.target.checked })}
                        />
                      </label>
                      <div className="space-y-2 text-xs text-muted">
                        <input
                          type="number"
                          step="0.0001"
                          value={model.inputPricePer1k}
                          onChange={(event) => onModelPatch(model.id, { inputPricePer1k: Number(event.target.value) })}
                          className="h-9 w-full rounded-xl border border-slate-200 px-2 text-sm outline-none"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={model.outputPricePer1k}
                          onChange={(event) => onModelPatch(model.id, { outputPricePer1k: Number(event.target.value) })}
                          className="h-9 w-full rounded-xl border border-slate-200 px-2 text-sm outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <select
                          value={model.fallback.condition}
                          onChange={(event) =>
                            onModelPatch(model.id, {
                              fallback: {
                                ...model.fallback,
                                condition: event.target.value as ModelRegistryItem['fallback']['condition'],
                              },
                            })
                          }
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none"
                        >
                          <option value="failure">{isZh ? '失败' : 'Failure'}</option>
                          <option value="timeout">{isZh ? '超时' : 'Timeout'}</option>
                          <option value="quota">{isZh ? '超限' : 'Quota'}</option>
                        </select>
                        <select
                          multiple
                          value={model.fallback.modelIds}
                          onChange={(event) =>
                            onModelPatch(model.id, {
                              fallback: {
                                ...model.fallback,
                                modelIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                              },
                            })
                          }
                          className="min-h-[82px] w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                        >
                          {models
                            .filter((candidate) => candidate.id !== model.id && candidate.enabled)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.displayName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteModel(model)}
                        className="self-start rounded-full border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        {isZh ? '删除' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
