import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { ActivityRow, ModelRegistryItem, ProviderRegistryItem } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface SystemHealthPanelProps {
  providers: ProviderRegistryItem[]
  incidents: ActivityRow[]
  recentActivity: ActivityRow[]
}

const providerTone = (status: ProviderRegistryItem['status']) =>
  status === 'available'
    ? 'success'
    : status === 'warning'
      ? 'warning'
      : status === 'error'
        ? 'danger'
        : 'default'

const eventTone = (tone?: ActivityRow['tone']) =>
  tone === 'critical' || tone === 'error' ? 'danger' : tone === 'warning' ? 'warning' : 'info'

export const SystemHealthPanel = ({ providers, incidents, recentActivity }: SystemHealthPanelProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const providerRows = useMemo(
    () => (providerFilter === 'all' ? providers : providers.filter((provider) => provider.id === providerFilter)),
    [providerFilter, providers],
  )

  const modelRows = useMemo(
    () =>
      providerRows
        .flatMap((provider) => provider.models.map((model) => ({ ...model, providerName: provider.name })))
        .sort((left, right) => right.failureRate24h - left.failureRate24h),
    [providerRows],
  )

  const eventRows = useMemo(
    () =>
      [...incidents, ...recentActivity]
        .filter((event) => (levelFilter === 'all' ? true : (event.tone ?? 'info') === levelFilter))
        .filter((event) => (providerFilter === 'all' ? true : event.targetId === providerFilter || event.description.includes(providerFilter)))
        .slice(0, 16),
    [incidents, levelFilter, providerFilter, recentActivity],
  )

  const selectedEvent =
    eventRows.find((event) => event.id === selectedEventId) ?? eventRows[0] ?? null

  const summary = useMemo(() => {
    const requestCount = providerRows.reduce((sum, provider) => sum + provider.requestCount24h, 0)
    const averageFailure = providerRows.length
      ? providerRows.reduce((sum, provider) => sum + (100 - provider.successRate24h), 0) / providerRows.length
      : 0
    const averageLatency = providerRows.length
      ? providerRows.reduce((sum, provider) => sum + provider.averageLatencyMs, 0) / providerRows.length
      : 0
    return {
      requestCount,
      averageFailure: Math.round(averageFailure * 10) / 10,
      averageLatency: Math.round(averageLatency),
      openAlerts: eventRows.filter((event) => event.tone === 'warning' || event.tone === 'error' || event.tone === 'critical').length,
    }
  }, [eventRows, providerRows])

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '运行状态' : 'System health'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isZh
                ? '按 provider、模型和告警事件统一查看平台运行状态。'
                : 'Inspect runtime health by provider, model, and alert event.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="all">{isZh ? '全部服务商' : 'All providers'}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as typeof levelFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="all">{isZh ? '全部级别' : 'All levels'}</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
              <option value="critical">critical</option>
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            [isZh ? '24h 请求数' : '24h requests', summary.requestCount.toLocaleString()],
            [isZh ? '平均失败率' : 'Average failure', `${summary.averageFailure}%`],
            [isZh ? '平均响应时间' : 'Average latency', `${summary.averageLatency}ms`],
            [isZh ? '待处理告警' : 'Open alerts', String(summary.openAlerts)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
            {isZh ? 'Provider 运行状态' : 'Provider runtime'}
          </h3>
          <div className="mt-4 space-y-3">
            {providerRows.map((provider) => (
              <div key={provider.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{provider.name}</p>
                    <p className="mt-1 text-xs text-subtle">{provider.baseUrl}</p>
                  </div>
                  <StatusBadge tone={providerTone(provider.status)}>
                    {isZh
                      ? provider.status === 'available'
                        ? '可用'
                        : provider.status === 'warning'
                          ? '告警'
                          : provider.status === 'error'
                            ? '错误'
                            : '未验证'
                      : provider.status}
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {isZh ? '最近健康检查' : 'Last check'}
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {provider.lastCheckedAt ? new Date(provider.lastCheckedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {isZh ? '24h 请求数' : '24h req'}
                    </p>
                    <p className="mt-1 text-sm text-ink">{provider.requestCount24h}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {isZh ? '成功率' : 'Success'}
                    </p>
                    <p className="mt-1 text-sm text-ink">{provider.successRate24h}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {isZh ? '平均延迟' : 'Latency'}
                    </p>
                    <p className="mt-1 text-sm text-ink">{provider.averageLatencyMs}ms</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {isZh ? '失败模型数' : 'Failing models'}
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {provider.models.filter((model) => model.failureRate24h >= 8).length}
                    </p>
                  </div>
                </div>
                {provider.lastErrorReason ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {provider.lastErrorReason}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
            {isZh ? '模型稳定性' : 'Model stability'}
          </h3>
          <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200">
            <div className="grid grid-cols-[1.3fr_120px_120px_120px_120px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
              <span>{isZh ? '模型' : 'Model'}</span>
              <span>{isZh ? '24h 调用' : '24h calls'}</span>
              <span>{isZh ? '失败率' : 'Failure'}</span>
              <span>{isZh ? '延迟' : 'Latency'}</span>
              <span>{isZh ? 'Fallback 次数' : 'Fallbacks'}</span>
            </div>
            <div className="divide-y divide-slate-200">
              {modelRows.slice(0, 10).map((model: ModelRegistryItem & { providerName: string }) => (
                <div
                  key={model.id}
                  className="grid grid-cols-[1.3fr_120px_120px_120px_120px] gap-4 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">{model.displayName}</p>
                    <p className="text-xs text-subtle">{model.providerName}</p>
                  </div>
                  <p className="text-muted">{Math.max(12, Math.round(model.priority * 14 + 18))}</p>
                  <p className="text-muted">{model.failureRate24h}%</p>
                  <p className="text-muted">{model.averageLatencyMs}ms</p>
                  <p className="text-muted">{Math.max(0, model.fallback.modelIds.length - 1)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '事件与告警' : 'Events and alerts'}
            </h3>
            <StatusBadge tone="info">
              {eventRows.length} {isZh ? '条' : 'rows'}
            </StatusBadge>
          </div>
          <div className="mt-4 space-y-2">
            {eventRows.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedEvent?.id === event.id
                    ? 'border-[#111827] bg-[#f8fbff]'
                    : 'border-slate-200 hover:bg-[#fafbfd]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{event.title}</p>
                    <p className="mt-1 text-sm text-muted">{event.description}</p>
                    <p className="mt-2 text-xs text-subtle">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge tone={eventTone(event.tone)}>{event.tone ?? 'info'}</StatusBadge>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
            {isZh ? '事件详情' : 'Event detail'}
          </h3>
          {selectedEvent ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">{selectedEvent.title}</p>
                    <p className="mt-2 text-sm leading-7 text-muted">{selectedEvent.description}</p>
                  </div>
                  <StatusBadge tone={eventTone(selectedEvent.tone)}>
                    {selectedEvent.tone ?? 'info'}
                  </StatusBadge>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  [isZh ? '发生时间' : 'Occurred at', new Date(selectedEvent.timestamp).toLocaleString()],
                  [isZh ? '关联对象' : 'Target', selectedEvent.targetId ?? '—'],
                  [isZh ? '来源分区' : 'Source section', selectedEvent.targetSection ?? 'system'],
                  [isZh ? '处理状态' : 'Handled', isZh ? '待处理 / 待确认' : 'Pending review'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
                    <p className="mt-2 text-sm font-medium text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-muted">
              {isZh
                ? '选择一条告警后，这里会显示关联对象、发生时间、处理状态和事件详情。'
                : 'Select an alert to inspect target, timestamp, handling state, and detail.'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
