import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AdminConsoleSnapshot, AdminUserRecord, PlatformQuotaPolicy } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface QuotaSettingsPanelProps {
  quotas: PlatformQuotaPolicy
  users: AdminUserRecord[]
  billing: AdminConsoleSnapshot['billing']
  onChange: (patch: Partial<PlatformQuotaPolicy>) => void
  onApplyUserOverrides: (userId: string, patch: Partial<AdminUserRecord>) => void
  presetRange?: 'today' | '7d' | '30d'
}

const Input = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) => (
  <label className="rounded-2xl border border-slate-200 px-4 py-3">
    <span className="text-xs uppercase tracking-[0.16em] text-subtle">{label}</span>
    <input
      type="number"
      min={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
    />
  </label>
)

export const QuotaSettingsPanel = ({
  quotas,
  users,
  billing,
  onChange,
  onApplyUserOverrides,
  presetRange = '30d',
}: QuotaSettingsPanelProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [range, setRange] = useState<'today' | '7d' | '30d'>(presetRange)
  const [tab, setTab] = useState<'quotas' | 'billing'>('quotas')
  const heavyUsers = useMemo(() => [...users].sort((a, b) => b.totalTokenUsed - a.totalTokenUsed).slice(0, 6), [users])

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{isZh ? '配额与计费' : 'Quotas & Billing'}</h2>
            <p className="mt-1 text-sm text-muted">
              {isZh
                ? '拆开平台默认规则、用户覆盖策略和费用统计，为未来账单与支付系统预留结构。'
                : 'Separate platform defaults, user overrides, and billing views for future invoicing and payments.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              {[
                ['quotas', isZh ? '配额规则' : 'Quota rules'],
                ['billing', isZh ? '费用统计' : 'Billing'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id as typeof tab)}
                  className={`rounded-full px-3 py-1.5 ${tab === id ? 'bg-[#111827] text-white' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              {[
                ['today', isZh ? '今日' : 'Today'],
                ['7d', isZh ? '7天' : '7d'],
                ['30d', isZh ? '30天' : '30d'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id as typeof range)}
                  className={`rounded-full px-3 py-1.5 ${range === id ? 'bg-[#111827] text-white' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm text-muted transition hover:text-ink"
            >
              <Download size={14} />
              {isZh ? '导出 CSV' : 'Export CSV'}
            </button>
          </div>
        </div>
      </section>

      {tab === 'quotas' ? (
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '平台默认配额' : 'Platform defaults'}</h3>
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <Input label={isZh ? '每日 Token 限额' : 'Daily token limit'} value={quotas.defaultDailyTokenLimit} onChange={(value) => onChange({ defaultDailyTokenLimit: value })} />
              <Input label={isZh ? '每月 Token 限额' : 'Monthly token limit'} value={quotas.defaultMonthlyTokenLimit} onChange={(value) => onChange({ defaultMonthlyTokenLimit: value })} />
              <Input label={isZh ? '最大可见模型数' : 'Max visible models'} value={quotas.defaultModelLimit} onChange={(value) => onChange({ defaultModelLimit: value })} />
              <Input label={isZh ? '每日请求次数上限' : 'Daily request cap'} value={quotas.defaultRequestLimitDaily} onChange={(value) => onChange({ defaultRequestLimitDaily: value })} />
              <Input label={isZh ? '单次请求最大 Token' : 'Max tokens per request'} value={quotas.defaultMaxRequestTokens} onChange={(value) => onChange({ defaultMaxRequestTokens: value })} />
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '超限处理方式' : 'Overage behavior'}</span>
                <select
                  value={quotas.overageBehavior}
                  onChange={(event) => onChange({ overageBehavior: event.target.value as PlatformQuotaPolicy['overageBehavior'] })}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="block">{isZh ? '阻止请求' : 'Block request'}</option>
                  <option value="notify">{isZh ? '仅提醒' : 'Notify only'}</option>
                  <option value="downgrade">{isZh ? '降级模型' : 'Downgrade model'}</option>
                  <option value="allow">{isZh ? '允许继续' : 'Allow with flag'}</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许切换模型' : 'Allow model switching'}</span>
                <input type="checkbox" checked={quotas.allowModelSwitching} onChange={(event) => onChange({ allowModelSwitching: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许自动选模' : 'Allow auto model select'}</span>
                <input type="checkbox" checked={quotas.allowAutoModelSelect} onChange={(event) => onChange({ allowAutoModelSelect: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许视觉模型' : 'Allow visual models'}</span>
                <input type="checkbox" checked={quotas.allowVisualModels} onChange={(event) => onChange({ allowVisualModels: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许高成本模型' : 'Allow high-cost models'}</span>
                <input type="checkbox" checked={quotas.allowHighCostModels} onChange={(event) => onChange({ allowHighCostModels: event.target.checked })} />
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '单用户覆盖规则' : 'Per-user overrides'}</h3>
                <p className="mt-1 text-sm text-muted">{isZh ? '处理白名单、高成本模型、视觉模型和单用户额度。' : 'Manage whitelists, high-cost access, visual access, and user-specific quotas.'}</p>
              </div>
              <StatusBadge tone="info">{isZh ? '支持按用户覆盖' : 'User overrides ready'}</StatusBadge>
            </div>
            <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
              <div className="grid grid-cols-[1.4fr_130px_130px_120px_120px_120px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
                <span>{isZh ? '用户' : 'User'}</span>
                <span>{isZh ? '日额' : 'Daily limit'}</span>
                <span>{isZh ? '月额' : 'Monthly limit'}</span>
                <span>{isZh ? '自动选模' : 'Auto model'}</span>
                <span>{isZh ? '视觉模型' : 'Vision'}</span>
                <span>{isZh ? '高成本模型' : 'High-cost'}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {heavyUsers.map((user) => (
                  <div key={user.userId} className="grid grid-cols-[1.4fr_130px_130px_120px_120px_120px] gap-4 px-4 py-4 text-sm">
                    <div>
                      <p className="font-medium text-ink">{user.name}</p>
                      <p className="text-xs text-subtle">{user.email}</p>
                    </div>
                    <input
                      type="number"
                      value={user.tokenQuotaDaily}
                      onChange={(event) => onApplyUserOverrides(user.userId, { tokenQuotaDaily: Number(event.target.value) })}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none"
                    />
                    <input
                      type="number"
                      value={user.tokenQuotaMonthly}
                      onChange={(event) => onApplyUserOverrides(user.userId, { tokenQuotaMonthly: Number(event.target.value) })}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none"
                    />
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={user.autoModelSelectionEnabled}
                        onChange={(event) => onApplyUserOverrides(user.userId, { autoModelSelectionEnabled: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={user.canUseVisionModels}
                        onChange={(event) => onApplyUserOverrides(user.userId, { canUseVisionModels: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={user.canUseHighCostModels}
                        onChange={(event) => onApplyUserOverrides(user.userId, { canUseHighCostModels: event.target.checked })}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{isZh ? '平台成本摘要' : 'Platform cost summary'}</h3>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{isZh ? '总成本' : 'Total cost'}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">${billing.totalCost.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{isZh ? '预估收入' : 'Estimated revenue'}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">${billing.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{isZh ? '时间范围' : 'Range'}</p>
                <p className="mt-2 text-base font-semibold text-ink">{range}</p>
              </div>
            </div>
          </section>

          {[billing.byUser, billing.byModel, billing.byProvider].map((rows, index) => (
            <section key={index} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
                {index === 0
                  ? isZh
                    ? '按用户统计'
                    : 'By user'
                  : index === 1
                    ? isZh
                      ? '按模型统计'
                      : 'By model'
                    : isZh
                      ? '按服务商统计'
                      : 'By provider'}
              </h3>
              <div className="mt-4 space-y-2">
                {rows.slice(0, 6).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{row.label}</p>
                      <p className="text-sm font-medium text-ink">${row.estimatedCost.toFixed(2)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                      <span>{row.tokens.toLocaleString()} Token</span>
                      <span>{row.requestCount} req</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
