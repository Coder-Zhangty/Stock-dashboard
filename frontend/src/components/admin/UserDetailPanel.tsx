import { ArrowLeft, ArrowRight, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import { deleteAdminUserMemory, fetchAdminUserMemories } from '../../services/admin'
import type { AdminUserRecord, PlatformQuotaPolicy } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface UserDetailPanelProps {
  user: AdminUserRecord | null
  quotas: PlatformQuotaPolicy
  onBack: () => void
  onUpdateUser: (patch: Partial<AdminUserRecord>) => void
  onResetPassword: (user: AdminUserRecord, mode: 'temporary' | 'link') => void
  onToggleUser: (user: AdminUserRecord) => void
  onDeleteUser: (user: AdminUserRecord) => void
}

const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-panel">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </section>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
    <p className="mt-2 break-words text-base font-semibold tracking-[-0.02em] text-ink">{value}</p>
  </div>
)

const ActivityList = ({
  rows,
  empty,
}: {
  rows: AdminUserRecord['recentRequests']
  empty: string
}) => {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-muted">{empty}</div>
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">{row.title}</p>
            <span className="text-xs text-subtle">{new Date(row.timestamp).toLocaleString()}</span>
          </div>
          <p className="mt-1 break-words text-sm text-muted">{row.description}</p>
        </div>
      ))}
    </div>
  )
}

export const UserDetailPanel = ({
  user,
  quotas,
  onBack,
  onUpdateUser,
  onResetPassword,
  onToggleUser,
  onDeleteUser,
}: UserDetailPanelProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [resetMode, setResetMode] = useState<'temporary' | 'link'>('temporary')
  const [memories, setMemories] = useState<
    Array<{
      id: string
      user_id: string
      content: string
      source_conversation_id?: string | null
      confidence: number
      status: 'active' | 'deleted'
      created_at: string
      updated_at: string
    }>
  >([])
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const loadMemories = async () => {
      try {
        const next = await fetchAdminUserMemories(user.userId)
        if (!cancelled) setMemories(next)
      } catch (error) {
        if (!cancelled) {
          setMemoryStatus(error instanceof Error ? error.message : isZh ? '加载用户记忆失败。' : 'Unable to load memories.')
        }
      }
    }
    void loadMemories()
    return () => {
      cancelled = true
    }
  }, [isZh, user])

  const handleDeleteMemory = async (memoryId: string) => {
    if (!user) return
    try {
      await deleteAdminUserMemory(user.userId, memoryId)
      setMemories((current) =>
        current.map((memory) =>
          memory.id === memoryId
            ? { ...memory, status: 'deleted', updated_at: new Date().toISOString() }
            : memory,
        ),
      )
      setMemoryStatus(isZh ? '已删除用户记忆。' : 'Memory deleted.')
    } catch (error) {
      setMemoryStatus(error instanceof Error ? error.message : isZh ? '删除用户记忆失败。' : 'Unable to delete memory.')
    }
  }

  if (!user) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-muted">
        {isZh
          ? '未找到该用户，返回用户概览页后重新选择。'
          : 'The user could not be found. Return to the user overview and select again.'}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-muted transition hover:border-slate-300 hover:text-ink"
        >
          <ArrowLeft size={15} />
          {isZh ? '返回用户概览' : 'Back to users'}
        </button>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-ink">{user.name}</h2>
              <StatusBadge tone={user.role === 'admin' ? 'info' : 'default'}>
                {isZh ? (user.role === 'admin' ? '管理员' : '用户') : user.role}
              </StatusBadge>
              <StatusBadge
                tone={
                  user.status === 'active'
                    ? 'success'
                    : user.status === 'pending'
                      ? 'info'
                      : user.status === 'suspended'
                        ? 'warning'
                        : 'danger'
                }
              >
                {isZh
                  ? {
                      active: '启用',
                      suspended: '暂停',
                      blocked: '封禁',
                      pending: '待激活',
                      disabled: '禁用',
                    }[user.status]
                  : user.status}
              </StatusBadge>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-5 text-sm text-muted">
              <span>
                {isZh ? '最近登录：' : 'Last login: '}
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : isZh ? '暂无' : 'Never'}
              </span>
              <span>
                {isZh ? '最近活跃：' : 'Last active: '}
                {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : isZh ? '暂无' : 'No activity'}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={isZh ? '今日 Token' : 'Today tokens'} value={user.tokenUsedDaily.toLocaleString()} />
            <Stat label={isZh ? '本月 Token' : 'Monthly tokens'} value={user.tokenUsedMonthly.toLocaleString()} />
            <Stat label={isZh ? '本月预估费用' : 'Monthly estimate'} value={`$${user.estimatedCostMonthly.toFixed(2)}`} />
            <Stat label={isZh ? '默认模型' : 'Default model'} value={user.defaultModelId ?? '—'} />
          </div>
        </div>
      </section>

      <Section title={isZh ? '基本信息' : 'Basic information'}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label={isZh ? '角色' : 'Role'} value={isZh ? (user.role === 'admin' ? '管理员' : '用户') : user.role} />
          <Stat
            label={isZh ? '状态' : 'Status'}
            value={
              isZh
                ? {
                    active: '启用',
                    suspended: '暂停',
                    blocked: '封禁',
                    pending: '待激活',
                    disabled: '禁用',
                  }[user.status]
                : user.status
            }
          />
          <Stat label={isZh ? '创建时间' : 'Created'} value={new Date(user.createdAt).toLocaleString()} />
          <Stat label={isZh ? '资料库文件' : 'Library files'} value={String(user.libraryCount)} />
        </div>
      </Section>

      <Section
        title={isZh ? 'Token 使用统计' : 'Token usage'}
        description={
          isZh
            ? '按日、周、月和累计追踪，用于客服排障和未来计费。'
            : 'Daily, weekly, monthly, and lifetime tracking for support and billing readiness.'
        }
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Stat label={isZh ? '今日' : 'Today'} value={user.tokenUsedDaily.toLocaleString()} />
          <Stat label={isZh ? '本周' : 'This week'} value={user.tokenUsedWeekly.toLocaleString()} />
          <Stat label={isZh ? '本月' : 'This month'} value={user.tokenUsedMonthly.toLocaleString()} />
          <Stat label={isZh ? '累计' : 'Lifetime'} value={user.totalTokenUsed.toLocaleString()} />
          <Stat label={isZh ? '输入 Token' : 'Input tokens'} value={user.promptTokens.toLocaleString()} />
          <Stat label={isZh ? '输出 Token' : 'Output tokens'} value={user.completionTokens.toLocaleString()} />
          <Stat label={isZh ? '本月预估费用' : 'Monthly estimate'} value={`$${user.estimatedCostMonthly.toFixed(2)}`} />
          <Stat label={isZh ? '累计预估费用' : 'Lifetime estimate'} value={`$${user.estimatedCostLifetime.toFixed(2)}`} />
        </div>
      </Section>

      <Section
        title={isZh ? '模型权限' : 'Model access'}
        description={
          isZh
            ? '控制 provider、模型池、自动选模和高成本能力。'
            : 'Control providers, model pool, auto selection, and high-cost capabilities.'
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '最大可见模型数' : 'Max visible models'}</span>
            <input
              type="number"
              min={1}
              value={user.maxSelectableModels}
              onChange={(event) => onUpdateUser({ maxSelectableModels: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '默认模型' : 'Default model'}</span>
            <input
              value={user.defaultModelId ?? ''}
              onChange={(event) => onUpdateUser({ defaultModelId: event.target.value })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          {[
            ['autoModelSelectionEnabled', isZh ? '允许自动选模' : 'Allow auto model selection'],
            ['canUseVisionModels', isZh ? '允许视觉模型' : 'Allow vision models'],
            ['canUseHighCostModels', isZh ? '允许高成本模型' : 'Allow high-cost models'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(user[key as keyof AdminUserRecord])}
                onChange={(event) => onUpdateUser({ [key]: event.target.checked } as Partial<AdminUserRecord>)}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '可使用 Provider' : 'Allowed providers'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.allowedProviderIds.map((providerId) => (
                <StatusBadge key={providerId} tone="default">
                  {providerId}
                </StatusBadge>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '可使用模型' : 'Allowed models'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.allowedModelIds.map((modelId) => (
                <StatusBadge key={modelId} tone="info">
                  {modelId}
                </StatusBadge>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={isZh ? '配额与超限策略' : 'Quota and overage'}
        description={
          isZh
            ? '平台默认值可在下方覆盖，并决定超限后的处理行为。'
            : 'Override platform defaults and decide how the account behaves after quota is exceeded.'
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '每日 Token 限额' : 'Daily token limit'}</span>
            <input
              type="number"
              min={1}
              value={user.tokenQuotaDaily}
              onChange={(event) => onUpdateUser({ tokenQuotaDaily: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '每月 Token 限额' : 'Monthly token limit'}</span>
            <input
              type="number"
              min={1}
              value={user.tokenQuotaMonthly}
              onChange={(event) => onUpdateUser({ tokenQuotaMonthly: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '每日请求次数上限' : 'Daily request limit'}</span>
            <input
              type="number"
              min={1}
              value={user.requestLimitDaily}
              onChange={(event) => onUpdateUser({ requestLimitDaily: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '单次请求最大 Token' : 'Max tokens per request'}</span>
            <input
              type="number"
              min={256}
              value={user.maxRequestTokens}
              onChange={(event) => onUpdateUser({ maxRequestTokens: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
            <span>{isZh ? '允许继续超额调用' : 'Allow overage requests'}</span>
            <input
              type="checkbox"
              checked={user.allowOverage}
              onChange={(event) => onUpdateUser({ allowOverage: event.target.checked })}
            />
          </label>
          <label className="rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '超限处理方式' : 'Overage behavior'}</span>
            <select
              value={user.overageBehavior}
              onChange={(event) => onUpdateUser({ overageBehavior: event.target.value as AdminUserRecord['overageBehavior'] })}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="block">{isZh ? '阻止请求' : 'Block request'}</option>
              <option value="notify">{isZh ? '仅提醒' : 'Notify only'}</option>
              <option value="downgrade">{isZh ? '降级模型' : 'Downgrade model'}</option>
              <option value="allow">{isZh ? '允许继续' : 'Allow with flag'}</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label={isZh ? '本月剩余额度' : 'Remaining this month'} value={(user.tokenQuotaMonthly - user.tokenUsedMonthly).toLocaleString()} />
          <Stat label={isZh ? '平台默认日额' : 'Platform daily default'} value={quotas.defaultDailyTokenLimit.toLocaleString()} />
          <Stat label={isZh ? '平台默认月额' : 'Platform monthly default'} value={quotas.defaultMonthlyTokenLimit.toLocaleString()} />
          <Stat label={isZh ? '平台超限策略' : 'Platform overage'} value={quotas.overageBehavior} />
        </div>
      </Section>

      <Section
        title={isZh ? '最近活动' : 'Recent activity'}
        description={isZh ? '用于排障、客服支持和计费纠纷处理。' : 'Used for investigation, support, and billing disputes.'}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-ink">{isZh ? '最近请求' : 'Recent requests'}</h4>
            <div className="mt-3">
              <ActivityList rows={user.recentRequests} empty={isZh ? '暂无请求记录' : 'No request history'} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">{isZh ? '最近文件上传' : 'Recent uploads'}</h4>
            <div className="mt-3">
              <ActivityList rows={user.recentUploads} empty={isZh ? '暂无上传记录' : 'No upload history'} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">{isZh ? '最近异常' : 'Recent events'}</h4>
            <div className="mt-3">
              <ActivityList rows={user.recentEvents} empty={isZh ? '暂无异常事件' : 'No incident history'} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">{isZh ? '最近模型切换' : 'Recent model switches'}</h4>
            <div className="mt-3">
              <ActivityList rows={user.recentModelSwitches} empty={isZh ? '暂无模型切换' : 'No model switches'} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={isZh ? '用户记忆' : 'User memory'}
        description={
          isZh
            ? '每个用户的记忆独立保存。管理员第一版只能查看和删除，不能替用户新增或改写。'
            : 'Memories are isolated per user. Admins can view and delete them, but cannot create or edit them in v1.'
        }
      >
        {memoryStatus ? <p className="mb-3 rounded-2xl bg-[#fbfcfe] px-4 py-3 text-sm text-muted">{memoryStatus}</p> : null}
        {memories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-muted">
            {isZh ? '暂无用户记忆。' : 'No user memories yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className={`rounded-2xl border px-4 py-3 ${
                  memory.status === 'deleted'
                    ? 'border-slate-200 bg-slate-50 opacity-70'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm leading-6 text-ink">{memory.content}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {isZh ? '状态' : 'Status'}: {memory.status} · {isZh ? '置信度' : 'Confidence'}:{' '}
                      {Math.round(memory.confidence * 100)}% · {isZh ? '更新' : 'Updated'}{' '}
                      {new Date(memory.updated_at).toLocaleString()}
                    </p>
                    {memory.source_conversation_id ? (
                      <p className="mt-1 text-xs text-subtle">
                        {isZh ? '来源会话' : 'Source conversation'}: {memory.source_conversation_id}
                      </p>
                    ) : null}
                  </div>
                  {memory.status !== 'deleted' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteMemory(memory.id)
                      }}
                      className="rounded-full border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      {isZh ? '删除' : 'Delete'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={isZh ? '危险操作区' : 'Danger zone'}
        description={
          isZh
            ? '这些动作会影响账户可访问性，且全部写入审计日志。'
            : 'These actions affect account access and are always written into audit logs.'
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-[#fafbfd] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onResetPassword(user, resetMode)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-50"
            >
              {isZh
                ? resetMode === 'temporary'
                  ? '生成临时密码'
                  : '发送重置链接'
                : resetMode === 'temporary'
                  ? 'Generate temporary password'
                  : 'Send reset link'}
            </button>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => setResetMode('temporary')}
                className={`rounded-full px-3 py-1.5 ${resetMode === 'temporary' ? 'bg-[#111827] text-white' : 'text-muted'}`}
              >
                {isZh ? '临时密码' : 'Temporary'}
              </button>
              <button
                type="button"
                onClick={() => setResetMode('link')}
                className={`rounded-full px-3 py-1.5 ${resetMode === 'link' ? 'bg-[#111827] text-white' : 'text-muted'}`}
              >
                {isZh ? '重置链接' : 'Reset link'}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onToggleUser(user)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
            >
              <ShieldAlert size={15} />
              {isZh
                ? user.status === 'active'
                  ? '暂停 / 封禁账号'
                  : '恢复账号'
                : user.status === 'active'
                  ? 'Suspend / block account'
                  : 'Restore account'}
            </button>
            <button
              type="button"
              onClick={() => onDeleteUser(user)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={15} />
              {isZh ? '删除账户' : 'Delete account'}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-muted">
            <div className="flex items-center justify-between gap-3">
              <span>{isZh ? '本次操作会同时写入审计日志' : 'This action also writes to audit logs'}</span>
              <ArrowRight size={15} />
            </div>
            <p className="mt-2">
              {isZh
                ? '密码重置、状态变更、删除用户都会保留改前/改后记录与操作来源。'
                : 'Password resets, state changes, and deletion keep before/after records and operator source.'}
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
