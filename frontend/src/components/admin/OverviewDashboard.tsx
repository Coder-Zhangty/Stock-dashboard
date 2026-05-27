import clsx from 'clsx'
import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { ActivityRow, AdminOverviewSection, OverviewMetricCard, TrendPoint } from '../../types/admin'
import { StatusBadge } from './StatusBadge'
import { StatsSummaryRow } from './StatsSummaryRow'

interface OverviewDashboardProps {
  data: AdminOverviewSection
  formatDate: (value: string) => string
  onCardNavigate: (card: OverviewMetricCard) => void
  onIncidentNavigate: (row: ActivityRow) => void
  refreshing?: boolean
}

const MiniBarChart = ({
  title,
  subtitle,
  points,
  dual,
}: {
  title: string
  subtitle: string
  points: TrendPoint[]
  dual?: boolean
}) => {
  const { locale } = useI18n()
  const max = Math.max(...points.flatMap((point) => [point.value, point.secondaryValue ?? 0]), 1)
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{title}</h3>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <StatusBadge tone="info">{locale === 'zh-CN' ? `${points.length} 个点位` : `${points.length} points`}</StatusBadge>
      </div>
      <div className="mt-6 flex h-44 items-end gap-3">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] px-2 pb-2">
              <div className="w-full rounded-full bg-[#111827]" style={{ height: `${Math.max(10, (point.value / max) * 100)}%` }} />
              {dual && point.secondaryValue ? (
                <div className="w-full rounded-full bg-blue-200" style={{ height: `${Math.max(10, (point.secondaryValue / max) * 100)}%` }} />
              ) : null}
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">{point.label}</p>
              <p className="mt-1 text-xs text-muted">{point.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const RankedList = ({ title, rows }: { title: string; rows: AdminOverviewSection['topUsers'] }) => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
    <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{title}</h3>
    <div className="mt-4 space-y-2">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center justify-between gap-4 rounded-2xl bg-[rgb(var(--surface-muted))] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {index + 1}. {row.label}
            </p>
            {row.sublabel ? <p className="truncate text-xs text-subtle">{row.sublabel}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-ink">{row.metricValue}</p>
            <p className="text-xs text-subtle">{row.metricLabel}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
)

export const OverviewDashboard = ({
  data,
  formatDate,
  onCardNavigate,
  onIncidentNavigate,
  refreshing = false,
}: OverviewDashboardProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')

  const requestTrend = useMemo(
    () => (range === 'today' ? data.requestTrend.slice(-1) : range === '7d' ? data.requestTrend : [...data.requestTrend, ...data.requestTrend.slice(-2)]),
    [data.requestTrend, range],
  )
  const tokenTrend = useMemo(
    () => (range === 'today' ? data.tokenTrend.slice(-1) : data.tokenTrend),
    [data.tokenTrend, range],
  )
  const activeTrend = useMemo(
    () => (range === 'today' ? data.activeUserTrend.slice(-1) : data.activeUserTrend),
    [data.activeUserTrend, range],
  )

  return (
    <div className="space-y-6">
      <div className="w-full">
        <StatsSummaryRow cards={data.cards} onCardClick={onCardNavigate} refreshing={refreshing} />
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-panel">
          {[
            ['today', isZh ? '今日' : 'Today'],
            ['7d', isZh ? '7天' : '7d'],
            ['30d', isZh ? '30天' : '30d'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id as typeof range)}
              className={clsx('rounded-full px-3 py-1.5', range === id ? 'bg-[#111827] text-white' : 'text-muted')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MiniBarChart title={isZh ? '请求量趋势' : 'Request volume'} subtitle={isZh ? '请求量走势' : 'Request trend'} points={requestTrend} />
        <MiniBarChart title={isZh ? 'Token 使用趋势' : 'Token usage'} subtitle={isZh ? '输入与输出 Token 趋势' : 'Input and output token trend'} points={tokenTrend} dual />
        <MiniBarChart title={isZh ? '活跃用户趋势' : 'Active users'} subtitle={isZh ? '活跃用户走势' : 'Rolling active-user signal'} points={activeTrend} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <RankedList title={isZh ? '高消耗用户' : 'Top users'} rows={data.topUsers} />
        <RankedList title={isZh ? '高频模型' : 'Top models'} rows={data.topModels} />
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '告警与异常事件' : 'Alerts and incidents'}</h3>
            <StatusBadge tone={data.incidents.length ? 'warning' : 'success'}>
              {data.incidents.length ? `${data.incidents.length} ${isZh ? '条待处理' : 'open'}` : isZh ? '稳定' : 'Stable'}
            </StatusBadge>
          </div>
          <div className="mt-4 space-y-2">
            {data.incidents.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onIncidentNavigate(row)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:bg-[#fafbfd]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{row.title}</p>
                    <p className="mt-1 text-sm text-muted">{row.description}</p>
                    <p className="mt-2 text-xs text-subtle">{formatDate(row.timestamp)}</p>
                  </div>
                  <span
                    className={clsx(
                      'mt-1 h-2.5 w-2.5 rounded-full',
                      row.tone === 'critical' && 'bg-rose-600',
                      row.tone === 'error' && 'bg-rose-500',
                      row.tone === 'warning' && 'bg-amber-500',
                      (!row.tone || row.tone === 'info') && 'bg-blue-500',
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '最近请求日志' : 'Recent request log'}</h3>
          <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200">
            <div className="grid grid-cols-[1.6fr_2fr_120px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
              <span>{isZh ? '请求' : 'Request'}</span>
              <span>{isZh ? '详情' : 'Detail'}</span>
              <span>{isZh ? '时间' : 'Time'}</span>
            </div>
            <div className="divide-y divide-slate-200">
              {data.recentRequests.map((row) => (
                <div key={row.id} className="grid grid-cols-[1.6fr_2fr_120px] gap-4 px-4 py-3 text-sm">
                  <p className="font-medium text-ink">{row.title}</p>
                  <p className="text-muted">{row.description}</p>
                  <p className="text-xs text-subtle">{formatDate(row.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '最近上传文件' : 'Recent uploads'}</h3>
            <div className="mt-4 space-y-2">
              {data.recentUploads.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">{row.title}</p>
                  <p className="mt-1 text-sm text-muted">{row.description}</p>
                  <p className="mt-2 text-xs text-subtle">{formatDate(row.timestamp)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '策略与后台变更' : 'Policy and admin changes'}</h3>
            <div className="mt-4 space-y-3">
              {data.recentChanges.map((log) => (
                <div key={log.id} className="rounded-2xl bg-[rgb(var(--surface-muted))] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-ink">{log.actionType}</p>
                    <StatusBadge tone={log.result === 'error' ? 'danger' : log.result === 'warning' ? 'warning' : 'success'}>
                      {isZh ? (log.result === 'error' ? '失败' : log.result === 'warning' ? '警告' : '成功') : log.result}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{log.detail}</p>
                  <p className="mt-2 text-xs text-subtle">{formatDate(log.timestamp)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
