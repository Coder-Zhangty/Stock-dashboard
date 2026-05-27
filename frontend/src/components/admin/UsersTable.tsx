import clsx from 'clsx'
import { ChevronDown, Eye, KeyRound, MoreHorizontal, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AdminUserRecord, AdminUserStatus } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

export interface UserListFilters {
  roleFilter: 'all' | 'admin' | 'user'
  statusFilter: 'all' | AdminUserStatus
  overQuotaFilter: 'all' | 'yes' | 'no'
  activityFilter: 'all' | '24h' | '7d'
  sortKey: 'tokens' | 'created' | 'active'
}

interface UsersTableProps {
  users: AdminUserRecord[]
  searchValue: string
  selectedUserId: string | null
  filters: UserListFilters
  onFiltersChange: (patch: Partial<UserListFilters>) => void
  onSelectUser: (userId: string) => void
  onCreateUser: () => void
  onEditPermissions: (user: AdminUserRecord) => void
  onResetPassword: (user: AdminUserRecord) => void
  onToggleUser: (user: AdminUserRecord) => void
  onDeleteUser: (user: AdminUserRecord) => void
  onBulkUpdate: (
    userIds: string[],
    action: 'activate' | 'suspend' | 'block' | 'quota' | 'models' | 'auto-model',
  ) => void
}

const statusTone = (status: AdminUserRecord['status']) => {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'info'
  if (status === 'suspended') return 'warning'
  return 'danger'
}

const statusLabel = (status: AdminUserStatus, isZh: boolean) =>
  isZh
    ? {
        active: '启用',
        suspended: '暂停',
        blocked: '封禁',
        pending: '待激活',
        disabled: '禁用',
      }[status]
    : status

export const UsersTable = ({
  users,
  searchValue,
  selectedUserId,
  filters,
  onFiltersChange,
  onSelectUser,
  onCreateUser,
  onEditPermissions,
  onResetPassword,
  onToggleUser,
  onDeleteUser,
  onBulkUpdate,
}: UsersTableProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'activate' | 'suspend' | 'block' | 'quota' | 'models' | 'auto-model'>(
    'activate',
  )
  const [referenceNow] = useState(() => Date.now())

  const filtered = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return [...users]
      .filter((user) => {
        if (
          keyword &&
          ![user.name, user.email, user.role, user.status, user.lastModel ?? '']
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        ) {
          return false
        }
        if (filters.roleFilter !== 'all' && user.role !== filters.roleFilter) return false
        if (filters.statusFilter !== 'all' && user.status !== filters.statusFilter) return false
        if (filters.overQuotaFilter === 'yes' && !user.overQuota) return false
        if (filters.overQuotaFilter === 'no' && user.overQuota) return false
        if (filters.activityFilter !== 'all') {
          if (!user.lastActiveAt) return false
          const diff = referenceNow - new Date(user.lastActiveAt).getTime()
          if (filters.activityFilter === '24h' && diff > 24 * 3600 * 1000) return false
          if (filters.activityFilter === '7d' && diff > 7 * 24 * 3600 * 1000) return false
        }
        return true
      })
      .sort((left, right) => {
        if (filters.sortKey === 'tokens') return right.totalTokenUsed - left.totalTokenUsed
        if (filters.sortKey === 'created') {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        }
        return new Date(right.lastActiveAt ?? 0).getTime() - new Date(left.lastActiveAt ?? 0).getTime()
      })
  }, [filters, referenceNow, searchValue, users])

  const allSelected = filtered.length > 0 && filtered.every((user) => selectedIds.includes(user.userId))

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{isZh ? '用户' : 'Users'}</h2>
          <p className="mt-1 text-sm text-muted">
            {isZh
              ? '搜索、筛选并批量管理账户、配额、模型权限和状态。'
              : 'Search, filter, and bulk manage account state, quotas, and model access.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateUser}
          className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a]"
        >
          <UserPlus size={15} />
          {isZh ? '创建用户' : 'Create user'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
        <label className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '角色' : 'Role'}</span>
          <select
            value={filters.roleFilter}
            onChange={(event) => onFiltersChange({ roleFilter: event.target.value as UserListFilters['roleFilter'] })}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            <option value="all">{isZh ? '全部角色' : 'All roles'}</option>
            <option value="admin">{isZh ? '管理员' : 'Admin'}</option>
            <option value="user">{isZh ? '普通用户' : 'User'}</option>
          </select>
        </label>
        <label className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '状态' : 'Status'}</span>
          <select
            value={filters.statusFilter}
            onChange={(event) => onFiltersChange({ statusFilter: event.target.value as UserListFilters['statusFilter'] })}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            <option value="all">{isZh ? '全部状态' : 'All states'}</option>
            <option value="active">{isZh ? '启用' : 'Active'}</option>
            <option value="suspended">{isZh ? '暂停' : 'Suspended'}</option>
            <option value="blocked">{isZh ? '封禁' : 'Blocked'}</option>
            <option value="pending">{isZh ? '待激活' : 'Pending'}</option>
          </select>
        </label>
        <label className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '超额' : 'Over quota'}</span>
          <select
            value={filters.overQuotaFilter}
            onChange={(event) =>
              onFiltersChange({ overQuotaFilter: event.target.value as UserListFilters['overQuotaFilter'] })
            }
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            <option value="all">{isZh ? '全部' : 'All'}</option>
            <option value="yes">{isZh ? '已超额' : 'Exceeded'}</option>
            <option value="no">{isZh ? '未超额' : 'Within quota'}</option>
          </select>
        </label>
        <label className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '最近活跃' : 'Recent activity'}</span>
          <select
            value={filters.activityFilter}
            onChange={(event) =>
              onFiltersChange({ activityFilter: event.target.value as UserListFilters['activityFilter'] })
            }
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            <option value="all">{isZh ? '不限' : 'Any time'}</option>
            <option value="24h">{isZh ? '24 小时内' : 'Within 24h'}</option>
            <option value="7d">{isZh ? '7 天内' : 'Within 7d'}</option>
          </select>
        </label>
        <label className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.16em] text-subtle">{isZh ? '排序' : 'Sort by'}</span>
          <select
            value={filters.sortKey}
            onChange={(event) => onFiltersChange({ sortKey: event.target.value as UserListFilters['sortKey'] })}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            <option value="tokens">{isZh ? 'Token 用量' : 'Token usage'}</option>
            <option value="active">{isZh ? '最近活跃' : 'Last active'}</option>
            <option value="created">{isZh ? '创建时间' : 'Created time'}</option>
          </select>
        </label>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-[#f8fafc] px-4 py-3">
          <p className="text-sm text-ink">
            {isZh ? `已选择 ${selectedIds.length} 个用户` : `${selectedIds.length} users selected`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="activate">{isZh ? '批量启用' : 'Activate'}</option>
              <option value="suspend">{isZh ? '批量暂停' : 'Suspend'}</option>
              <option value="block">{isZh ? '批量封禁' : 'Block'}</option>
              <option value="quota">{isZh ? '批量修改额度' : 'Bulk quota'}</option>
              <option value="models">{isZh ? '批量分配模型' : 'Assign models'}</option>
              <option value="auto-model">{isZh ? '自动选模开关' : 'Auto model toggle'}</option>
            </select>
            <button
              type="button"
              onClick={() => onBulkUpdate(selectedIds, bulkAction)}
              className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a]"
            >
              {isZh ? '执行批量操作' : 'Apply bulk action'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
        <div className="grid grid-cols-[42px_minmax(0,2.2fr)_110px_110px_128px_180px_150px_120px] gap-4 bg-[#f8f9fb] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
          <label className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => setSelectedIds(event.target.checked ? filtered.map((user) => user.userId) : [])}
            />
          </label>
          <span>{isZh ? '用户' : 'User'}</span>
          <span>{isZh ? '角色' : 'Role'}</span>
          <span>{isZh ? '状态' : 'Status'}</span>
          <span>{isZh ? '模型数' : 'Models'}</span>
          <span>{isZh ? 'Token / 限额' : 'Token / quota'}</span>
          <span>{isZh ? '最近活跃' : 'Last active'}</span>
          <span>{isZh ? '操作' : 'Actions'}</span>
        </div>
        <div className="divide-y divide-slate-200">
          {filtered.map((user) => {
            const selected = selectedIds.includes(user.userId)
            return (
              <div
                key={user.userId}
                className={clsx(
                  'grid grid-cols-[42px_minmax(0,2.2fr)_110px_110px_128px_180px_150px_120px] gap-4 px-4 py-4 text-sm transition hover:bg-[#fafbfd]',
                  selectedUserId === user.userId && 'bg-[#f8fbff]',
                )}
              >
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, user.userId]
                          : current.filter((item) => item !== user.userId),
                      )
                    }
                  />
                </label>
                <button type="button" onClick={() => onSelectUser(user.userId)} className="min-w-0 text-left">
                  <p className="truncate font-medium text-ink" title={user.name}>
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-subtle" title={user.email}>
                    {user.email}
                  </p>
                  {user.overQuota ? (
                    <p className="mt-1 text-[11px] text-amber-600">
                      {isZh ? '已接近或超过额度' : 'Near or over quota'}
                    </p>
                  ) : null}
                </button>
                <div className="flex items-center">
                  <StatusBadge tone={user.role === 'admin' ? 'info' : 'default'}>
                    {isZh ? (user.role === 'admin' ? '管理员' : '用户') : user.role}
                  </StatusBadge>
                </div>
                <div className="flex items-center">
                  <StatusBadge tone={statusTone(user.status)}>{statusLabel(user.status, isZh)}</StatusBadge>
                </div>
                <div className="text-muted">
                  <p>{user.allowedModelIds.length}</p>
                  <p className="text-xs text-subtle">
                    {isZh ? '上限' : 'max'} {user.maxSelectableModels}
                  </p>
                </div>
                <div className="text-muted">
                  <p className="truncate" title={user.tokenUsedMonthly.toLocaleString()}>
                    {user.tokenUsedMonthly.toLocaleString()}
                  </p>
                  <p className="truncate text-xs text-subtle" title={user.tokenQuotaMonthly.toLocaleString()}>
                    / {user.tokenQuotaMonthly.toLocaleString()}
                  </p>
                </div>
                <div className="text-xs text-subtle">
                  {user.lastActiveAt
                    ? new Date(user.lastActiveAt).toLocaleString(isZh ? 'zh-CN' : 'en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : isZh
                      ? '暂无活动'
                      : 'No activity'}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectUser(user.userId)}
                    className="rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
                    title={isZh ? '查看详情' : 'View detail'}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onResetPassword(user)}
                    className="rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
                    title={isZh ? '重置密码' : 'Reset password'}
                  >
                    <KeyRound size={15} />
                  </button>
                  <details className="relative">
                    <summary className="list-none rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink">
                      <MoreHorizontal size={15} />
                    </summary>
                    <div className="absolute right-0 top-10 z-20 min-w-[176px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                      <button
                        type="button"
                        onClick={() => onEditPermissions(user)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#f8fafc]"
                      >
                        <span>{isZh ? '查看并编辑详情' : 'Open detail view'}</span>
                        <ChevronDown size={14} className="rotate-[-90deg]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleUser(user)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#f8fafc]"
                      >
                        <span>{isZh ? '变更状态' : 'Change state'}</span>
                        <ChevronDown size={14} className="rotate-[-90deg]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteUser(user)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                      >
                        <span>{isZh ? '删除用户' : 'Delete user'}</span>
                        <ChevronDown size={14} className="rotate-[-90deg]" />
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
