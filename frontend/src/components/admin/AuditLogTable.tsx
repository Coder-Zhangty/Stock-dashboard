import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AuditLogRecord } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface AuditLogTableProps {
  logs: AuditLogRecord[]
  searchValue: string
}

export const AuditLogTable = ({ logs, searchValue }: AuditLogTableProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all')
  const [targetFilter, setTargetFilter] = useState<'all' | NonNullable<AuditLogRecord['targetType']>>('all')
  const [actorFilter, setActorFilter] = useState<'all' | AuditLogRecord['actorRole']>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    return logs.filter((log) => {
      if (
        keyword &&
        ![log.actor, log.actionType, log.target, log.detail, log.source, log.oldValue, log.newValue]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      )
        return false
      if (resultFilter !== 'all' && log.result !== resultFilter) return false
      if (targetFilter !== 'all' && log.targetType !== targetFilter) return false
      if (actorFilter !== 'all' && log.actorRole !== actorFilter) return false
      return true
    })
  }, [actorFilter, logs, resultFilter, searchValue, targetFilter])

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{isZh ? '审计日志' : 'Audit log'}</h2>
          <p className="mt-1 text-sm text-muted">
            {isZh
              ? '记录用户、服务商、模型、配额和策略的改动轨迹。'
              : 'Track users, providers, models, quota changes, and policy updates.'}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '结果' : 'Result'}</span>
            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="all">{isZh ? '全部结果' : 'All results'}</option>
              <option value="success">{isZh ? '成功' : 'Success'}</option>
              <option value="warning">{isZh ? '警告' : 'Warning'}</option>
              <option value="error">{isZh ? '失败' : 'Error'}</option>
            </select>
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '目标对象' : 'Target type'}</span>
            <select
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value as typeof targetFilter)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="all">{isZh ? '全部对象' : 'All targets'}</option>
              <option value="user">{isZh ? '用户' : 'User'}</option>
              <option value="provider">{isZh ? '服务商' : 'Provider'}</option>
              <option value="model">{isZh ? '模型' : 'Model'}</option>
              <option value="policy">{isZh ? '策略' : 'Policy'}</option>
              <option value="quota">{isZh ? '配额' : 'Quota'}</option>
              <option value="file">{isZh ? '文件' : 'File'}</option>
              <option value="routing">{isZh ? '路由' : 'Routing'}</option>
            </select>
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '操作人' : 'Actor'}</span>
            <select
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value as typeof actorFilter)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="all">{isZh ? '全部' : 'All actors'}</option>
              <option value="admin">{isZh ? '管理员' : 'Admin'}</option>
              <option value="user">{isZh ? '用户' : 'User'}</option>
              <option value="system">{isZh ? '系统' : 'System'}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
        <div className="grid grid-cols-[160px_120px_170px_160px_1fr_110px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
          <span>{isZh ? '时间' : 'Time'}</span>
          <span>{isZh ? '操作人' : 'Actor'}</span>
          <span>{isZh ? '动作' : 'Action'}</span>
          <span>{isZh ? '目标对象' : 'Target'}</span>
          <span>{isZh ? '详情' : 'Detail'}</span>
          <span>{isZh ? '结果' : 'Result'}</span>
        </div>
        <div className="divide-y divide-slate-200">
          {filtered.map((log) => (
            <div key={log.id}>
              <button
                type="button"
                onClick={() => setExpandedId((current) => (current === log.id ? null : log.id))}
                className="grid w-full grid-cols-[160px_120px_170px_160px_1fr_110px] gap-4 px-4 py-4 text-left text-sm transition hover:bg-[#fafbfd]"
              >
                <p className="text-xs text-subtle">{new Date(log.timestamp).toLocaleString()}</p>
                <div>
                  <p className="font-medium text-ink">{log.actor}</p>
                  <p className="text-xs text-subtle">{isZh ? (log.actorRole === 'admin' ? '管理员' : log.actorRole === 'user' ? '用户' : '系统') : log.actorRole}</p>
                </div>
                <p className="font-medium text-ink">{log.actionType}</p>
                <div>
                  <p className="font-medium text-ink">{log.target}</p>
                  <p className="text-xs text-subtle">{log.targetType ?? '—'}</p>
                </div>
                <p className="text-muted">{log.detail}</p>
                <div className="flex items-center">
                  <StatusBadge tone={log.result === 'error' ? 'danger' : log.result === 'warning' ? 'warning' : 'success'}>
                    {isZh ? (log.result === 'error' ? '失败' : log.result === 'warning' ? '警告' : '成功') : log.result}
                  </StatusBadge>
                </div>
              </button>
              {expandedId === log.id ? (
                <div className="border-t border-slate-200 bg-[#fbfcfe] px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '来源' : 'Source'}</p>
                      <p className="mt-2 text-sm text-ink">{log.source ?? (isZh ? '后台控制台' : 'Admin console')}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '精确时间' : 'Precise time'}</p>
                      <p className="mt-2 text-sm text-ink">{new Date(log.timestamp).toISOString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '改前值' : 'Previous value'}</p>
                      <p className="mt-2 text-sm text-ink">{log.oldValue ?? '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '改后值' : 'New value'}</p>
                      <p className="mt-2 text-sm text-ink">{log.newValue ?? '—'}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
