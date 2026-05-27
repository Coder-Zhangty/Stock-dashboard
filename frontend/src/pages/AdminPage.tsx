import {
  Activity,
  Bot,
  BookCopy,
  Coins,
  FileStack,
  Plus,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AdminLayout } from '../components/admin/AdminLayout'
import { AuditLogTable } from '../components/admin/AuditLogTable'
import { ConfirmDialog } from '../components/admin/ConfirmDialog'
import { LibraryDetailView } from '../components/admin/LibraryDetailView'
import { LibraryTable } from '../components/admin/LibraryTable'
import { ModelsPanel } from '../components/admin/ModelsPanel'
import { OverviewDashboard } from '../components/admin/OverviewDashboard'
import { PoliciesPanel } from '../components/admin/PoliciesPanel'
import { QuotaSettingsPanel } from '../components/admin/QuotaSettingsPanel'
import { SystemHealthPanel } from '../components/admin/SystemHealthPanel'
import { UserDetailPanel } from '../components/admin/UserDetailPanel'
import { UsersTable } from '../components/admin/UsersTable'
import type { LibraryListFilters, LibraryScopeSelection } from '../components/admin/LibraryTable'
import type { UserListFilters } from '../components/admin/UsersTable'
import {
  appendAdminLog,
  buildAdminConsoleSnapshot,
  createUserSeed,
  readAdminConsoleState,
  writeAdminConsoleState,
} from '../lib/adminData'
import { useI18n } from '../i18n/I18nProvider'
import {
  createModel,
  createProvider,
  createUser,
  deleteModel,
  deleteProvider,
  deleteUser,
  disableUser,
  enableUser,
  fetchAdminOverview,
  resetUserPassword,
  syncProvider,
  testProvider,
  updateUser,
} from '../services/admin'
import { fetchManagedRouting, updateManagedRouting, updatePermissions } from '../services/aiPlatform'
import type {
  AdminConsoleLocalState,
  AdminSection,
  AdminUserRecord,
  AuditLogRecord,
  EventLevel,
  LibraryRecord,
  ModelRegistryItem,
  OverviewMetricCard,
  ProviderRegistryItem,
} from '../types/admin'
import type { AuthSession } from '../types/auth'
import type { AdminProviderCatalog, ManagedProviderConfig, ManagedRoutingState } from '../types/chat'

interface AdminPageProps {
  session: AuthSession
  onLogout: () => void
}

type ConfirmState =
  | { type: 'delete-user'; user: AdminUserRecord }
  | { type: 'toggle-user'; user: AdminUserRecord }
  | { type: 'reset-password'; user: AdminUserRecord; mode: 'temporary' | 'link' }
  | { type: 'delete-file'; file: LibraryRecord }
  | { type: 'delete-provider'; provider: ProviderRegistryItem }
  | { type: 'delete-model'; model: ModelRegistryItem }
  | null

type UsersView = 'list' | 'detail'
type LibraryView = 'list' | 'detail'

const copy = {
  'zh-CN': {
    sections: {
      overview: {
        title: '总览',
        description: '用更像运营控制台的方式查看用户、调用、模型、文件与异常事件。',
      },
      users: {
        title: '用户',
        description: '管理账户状态、配额、模型权限、密码重置和批量操作。',
      },
      models: {
        title: '模型与服务商',
        description: '维护服务商接入、模型开放范围、默认路由、fallback 与自动选模策略。',
      },
      quotas: {
        title: '配额与计费',
        description: '统一管理平台默认配额、单用户覆盖规则、Token 统计与成本预估。',
      },
      library: {
        title: '资料库',
        description: '按文件、状态、归属和引用关系查看平台资料库资产。',
      },
      system: {
        title: '运行状态',
        description: '查看服务商健康、模型稳定性、异常告警和近期系统事件。',
      },
      policies: {
        title: '权限与策略',
        description: '维护平台默认策略、用户访问控制和模型治理规则。',
      },
      logs: {
        title: '审计日志',
        description: '追踪后台操作、变更记录、执行结果与关键对象详情。',
      },
    },
    refresh: '刷新数据',
    refreshing: '刷新中...',
    refreshedAt: '最近刷新',
    createUser: '创建用户',
    createUserTitle: '创建新用户',
    createUserHint: '优先按未来真实后台的数据结构创建账户，后续可平滑接入正式管理接口。',
    name: '用户名',
    email: '邮箱',
    password: '初始密码',
    role: '角色',
    cancel: '取消',
    create: '创建',
    saveRouting: '保存模型托管',
    savingRouting: '保存模型托管中...',
    savePolicies: '保存策略',
    savingPolicies: '保存策略中...',
    saveSuccess: '已保存',
    dialog: {
      deleteTitle: '删除该用户？',
      deleteBody: '该操作会移除后台中的用户记录，并写入审计日志。',
      toggleTitle: '变更账户状态？',
      toggleBody: '账户状态变化会影响请求资格、登录权限和平台可见性。',
      resetTitle: '执行密码重置？',
      resetBodyTemporary: '将生成一组临时密码并写入审计日志。',
      resetBodyLink: '将生成一条重置链接事件并写入审计日志。',
      deleteConfirm: '删除用户',
      deleteFileTitle: '删除这个文件？',
      deleteFileBody: '这会把文件标记为已删除，并写入资料库审计日志。',
      deleteFileConfirm: '删除文件',
      toggleConfirm: '确认变更',
      resetConfirmTemporary: '生成临时密码',
      resetConfirmLink: '发送重置链接',
    },
  },
  'en-US': {
    sections: {
      overview: {
        title: 'Overview',
        description: 'Inspect users, usage, models, files, and incidents like a real operating console.',
      },
      users: {
        title: 'Users',
        description: 'Manage account state, quotas, model access, resets, and bulk actions.',
      },
      models: {
        title: 'Models & Providers',
        description: 'Maintain provider connectivity, model exposure, defaults, fallbacks, and routing policy.',
      },
      quotas: {
        title: 'Quotas & Billing',
        description: 'Manage platform defaults, user overrides, token usage, and cost estimation.',
      },
      library: {
        title: 'Library',
        description: 'Track indexed assets by file, owner, status, and reference relations.',
      },
      system: {
        title: 'System',
        description: 'Inspect provider health, model stability, alerts, and recent system events.',
      },
      policies: {
        title: 'Policies',
        description: 'Maintain platform defaults, user access controls, and model governance rules.',
      },
      logs: {
        title: 'Audit Logs',
        description: 'Trace admin actions, changes, results, and object-level detail.',
      },
    },
    refresh: 'Refresh data',
    refreshing: 'Refreshing...',
    refreshedAt: 'Updated',
    createUser: 'Create user',
    createUserTitle: 'Create user',
    createUserHint: 'Create accounts against a future-ready data model so the console can later attach to a real admin API.',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    cancel: 'Cancel',
    create: 'Create',
    saveRouting: 'Save hosting',
    savingRouting: 'Saving hosting...',
    savePolicies: 'Save policies',
    savingPolicies: 'Saving policies...',
    saveSuccess: 'Saved',
    dialog: {
      deleteTitle: 'Delete this user?',
      deleteBody: 'This removes the account from the control plane and writes an audit log entry.',
      toggleTitle: 'Change account state?',
      toggleBody: 'Changing account state affects login access, request eligibility, and visibility.',
      resetTitle: 'Run password reset?',
      resetBodyTemporary: 'This generates a temporary password event and writes it to the audit log.',
      resetBodyLink: 'This generates a reset-link event and writes it to the audit log.',
      deleteConfirm: 'Delete user',
      deleteFileTitle: 'Delete this file?',
      deleteFileBody: 'This marks the file as deleted and writes an audit log entry.',
      deleteFileConfirm: 'Delete file',
      toggleConfirm: 'Apply change',
      resetConfirmTemporary: 'Generate temporary password',
      resetConfirmLink: 'Send reset link',
    },
  },
} as const

export const AdminPage = ({ session, onLogout }: AdminPageProps) => {
  const { locale, formatDate } = useI18n()
  const text = locale === 'zh-CN' ? copy['zh-CN'] : copy['en-US']

  const [section, setSection] = useState<AdminSection>('overview')
  const [searchValue, setSearchValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<Awaited<ReturnType<typeof fetchAdminOverview>> | null>(null)
  const [previousOverviewData, setPreviousOverviewData] = useState<Awaited<ReturnType<typeof fetchAdminOverview>> | null>(null)
  const [adminCatalog, setAdminCatalog] = useState<AdminProviderCatalog | null>(null)
  const [previousAdminCatalog, setPreviousAdminCatalog] = useState<AdminProviderCatalog | null>(null)
  const overviewDataRef = useRef<Awaited<ReturnType<typeof fetchAdminOverview>> | null>(null)
  const adminCatalogRef = useRef<AdminProviderCatalog | null>(null)
  const [localState, setLocalState] = useState<AdminConsoleLocalState>(() => readAdminConsoleState())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [usersView, setUsersView] = useState<UsersView>('list')
  const [usersFilters, setUsersFilters] = useState<UserListFilters>({
    roleFilter: 'all',
    statusFilter: 'all',
    overQuotaFilter: 'all',
    activityFilter: 'all',
    sortKey: 'tokens',
  })
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null)
  const [libraryView, setLibraryView] = useState<LibraryView>('list')
  const [selectedLibraryScope, setSelectedLibraryScope] = useState<LibraryScopeSelection>({ type: 'all', key: 'all' })
  const [libraryFilters, setLibraryFilters] = useState<LibraryListFilters>({
    typeFilter: 'all',
    statusFilter: 'all',
    ownerFilter: 'all',
  })
  const [activeProviderId, setActiveProviderId] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [savingRouting, setSavingRouting] = useState(false)
  const [savingPolicies, setSavingPolicies] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createProviderOpen, setCreateProviderOpen] = useState(false)
  const [createModelOpen, setCreateModelOpen] = useState(false)
  const [creatingProvider, setCreatingProvider] = useState(false)
  const [creatingModel, setCreatingModel] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null)
  const [providerTestResult, setProviderTestResult] = useState<{
    providerId: string
    detail: string
    latencyMs?: number | null
    checkedAt?: string | null
  } | null>(null)
  const [createDraft, setCreateDraft] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  })
  const [providerDraft, setProviderDraft] = useState({
    id: '',
    name: '',
    type: 'qwen' as 'openai' | 'openai_compatible' | 'qwen' | 'gemini' | 'anthropic' | 'deepseek' | 'custom' | 'mock',
    baseUrl: '',
    apiKey: '',
    description: '',
  })
  const [modelDraft, setModelDraft] = useState({
    id: '',
    providerId: '',
    displayName: '',
    internalName: '',
    type: 'chat' as 'chat' | 'vision' | 'image' | 'embedding' | 'audio',
    inputPricePer1k: '0',
    outputPricePer1k: '0',
    imagePricePerCall: '0',
    priority: '0',
    contextWindow: '',
    tags: '',
  })
  const [quotaRangePreset, setQuotaRangePreset] = useState<'today' | '7d' | '30d'>('30d')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const navItems = [
    { id: 'overview' as const, label: text.sections.overview.title, icon: ShieldCheck },
    { id: 'users' as const, label: text.sections.users.title, icon: Users },
    { id: 'models' as const, label: text.sections.models.title, icon: Bot },
    { id: 'quotas' as const, label: text.sections.quotas.title, icon: Coins },
    { id: 'library' as const, label: text.sections.library.title, icon: FileStack },
    { id: 'system' as const, label: text.sections.system.title, icon: Activity },
    { id: 'policies' as const, label: text.sections.policies.title, icon: BookCopy },
    { id: 'logs' as const, label: text.sections.logs.title, icon: ScrollText },
  ]

  const slugify = useCallback((value: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return normalized || `item-${Date.now()}`
  }, [])

  const patchLocalState = useCallback((updater: (current: AdminConsoleLocalState) => AdminConsoleLocalState) => {
    setLocalState((current) => {
      const next = updater(current)
      return { ...next, lastSavedAt: new Date().toISOString() }
    })
  }, [])

  useEffect(() => {
    writeAdminConsoleState(localState)
  }, [localState])

  useEffect(() => {
    overviewDataRef.current = overviewData
  }, [overviewData])

  useEffect(() => {
    adminCatalogRef.current = adminCatalog
  }, [adminCatalog])

  const appendLog = useCallback(
    (entry: Omit<Parameters<typeof appendAdminLog>[1], 'timestamp'> & { timestamp?: string }) => {
      patchLocalState((current) =>
        appendAdminLog(current, {
          ...entry,
          timestamp: entry.timestamp ?? new Date().toISOString(),
        }),
      )
    },
    [patchLocalState],
  )

  const loadData = useCallback(async (options?: { probeProviders?: boolean }) => {
    try {
      setRefreshing(true)
      let catalogForRefresh = await fetchManagedRouting()

      if (options?.probeProviders) {
        const providersToProbe = catalogForRefresh.providers.filter((provider) => provider.enabled && provider.id !== 'mock')
        await Promise.allSettled(providersToProbe.map((provider) => testProvider(provider.id)))
        catalogForRefresh = await fetchManagedRouting()
      }

      const [nextOverview, nextCatalog] = await Promise.all([fetchAdminOverview(), Promise.resolve(catalogForRefresh)])
      setPreviousOverviewData(overviewDataRef.current)
      setPreviousAdminCatalog(adminCatalogRef.current)
      setOverviewData(nextOverview)
      setAdminCatalog(nextCatalog)
      setLocalState((current) =>
        nextOverview.auditLogs?.length
          ? { ...current, auditLogs: nextOverview.auditLogs as AuditLogRecord[] }
          : current,
      )
      setSelectedUserId((current) => current ?? nextOverview.users[0]?.userId ?? null)
      setSelectedLibraryId((current) => current ?? nextOverview.libraryItems[0]?.id ?? null)
      setActiveProviderId((current) => current || nextCatalog.providers[0]?.id || '')
      setError(null)
      setLastUpdatedAt(new Date().toISOString())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '加载管理后台失败。'
            : 'Unable to load control plane.',
      )
    } finally {
      setRefreshing(false)
    }
  }, [locale])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const snapshot = useMemo(() => {
    if (!overviewData || !adminCatalog) return null
    return buildAdminConsoleSnapshot(
      overviewData,
      adminCatalog,
      localState,
      locale === 'zh-CN' ? 'zh-CN' : 'en-US',
      previousOverviewData,
      previousAdminCatalog,
    )
  }, [adminCatalog, localState, locale, overviewData, previousAdminCatalog, previousOverviewData])

  const selectedUser = snapshot?.users.find((user) => user.userId === selectedUserId) ?? snapshot?.users[0] ?? null
  const selectedLibrary =
    snapshot?.library.find((item) => item.id === selectedLibraryId) ?? snapshot?.library[0] ?? null
  const currentMeta = text.sections[section]
  const displayMeta =
    section === 'users' && usersView === 'detail'
      ? {
          title: locale === 'zh-CN' ? '用户详情' : 'User detail',
          description:
            locale === 'zh-CN'
              ? '查看账户信息、Token 用量、模型权限、配额策略和最近活动。'
              : 'Inspect account profile, token usage, model access, quotas, and recent activity.',
        }
      : section === 'library' && libraryView === 'detail'
        ? {
            title: locale === 'zh-CN' ? '文件详情' : 'File detail',
            description:
              locale === 'zh-CN'
                ? '查看文件状态、引用关系、索引信息和资料库操作。'
                : 'Inspect file status, references, indexing detail, and library actions.',
          }
      : currentMeta

  const openUserDetail = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setUsersView('detail')
  }, [])

  const returnToUsersList = useCallback(() => {
    setUsersView('list')
  }, [])

  const openLibraryDetail = useCallback(
    (fileId: string) => {
      const item = snapshot?.library.find((entry) => entry.id === fileId)
      if (item?.scopeType && item.scopeKey) {
        setSelectedLibraryScope({ type: item.scopeType, key: item.scopeKey })
      }
      setSelectedLibraryId(fileId)
      setLibraryView('detail')
    },
    [snapshot],
  )

  const returnToLibraryList = useCallback(() => {
    setLibraryView('list')
  }, [])

  const handleSelectLibraryScope = useCallback((scope: LibraryScopeSelection) => {
    setSelectedLibraryScope(scope)
  }, [])

  const updateUserRecord = useCallback(
    (user: AdminUserRecord, patch: Partial<AdminUserRecord>) => {
      if (!user.isLocalOnly) {
        void updateUser(user.userId, patch)
      }

      patchLocalState((current) => {
        if (user.isLocalOnly) {
          return {
            ...current,
            localUsers: current.localUsers.map((entry) =>
              entry.userId === user.userId ? { ...entry, ...patch } : entry,
            ),
          }
        }

        return {
          ...current,
          userOverrides: {
            ...current.userOverrides,
            [user.userId]: {
              ...current.userOverrides[user.userId],
              ...patch,
            },
          },
        }
      })
    },
    [patchLocalState],
  )

  const patchProviderDraft = useCallback((providerId: string, patch: Partial<ManagedProviderConfig>) => {
    setAdminCatalog((current) =>
      current
        ? {
            ...current,
            providers: current.providers.map((provider) =>
              provider.id === providerId ? { ...provider, ...patch } : provider,
            ),
          }
        : current,
    )
  }, [])

  const patchRouting = useCallback((patch: Partial<ManagedRoutingState>) => {
    setAdminCatalog((current) =>
      current
        ? {
            ...current,
            managedRouting: { ...current.managedRouting, ...patch },
          }
        : current,
    )
  }, [])

  const patchModelOverride = useCallback(
    (modelId: string, patch: Partial<NonNullable<AdminConsoleLocalState['modelOverrides'][string]>>) => {
      patchLocalState((current) => ({
        ...current,
        modelOverrides: {
          ...current.modelOverrides,
          [modelId]: {
            ...current.modelOverrides[modelId],
            ...patch,
          },
        },
      }))
      setAdminCatalog((current) =>
        current
          ? {
              ...current,
              providers: current.providers.map((provider) => ({
                ...provider,
                models: provider.models.map((model) =>
                  model.id === modelId
                    ? {
                        ...model,
                        available: typeof patch.enabled === 'boolean' ? patch.enabled : model.available,
                        enabledForAdmin:
                          typeof patch.enabled === 'boolean' ? patch.enabled : model.enabledForAdmin,
                        enabledForUser:
                          typeof patch.visibleToUsers === 'boolean'
                            ? patch.visibleToUsers
                            : model.enabledForUser,
                        allowAutoSelect:
                          typeof patch.allowAutoSelect === 'boolean'
                            ? patch.allowAutoSelect
                            : model.allowAutoSelect,
                      }
                    : model,
                ),
              })),
            }
          : current,
      )
    },
    [patchLocalState],
  )

  const patchLibraryRecord = useCallback(
    (fileId: string, patch: Partial<NonNullable<AdminConsoleLocalState['libraryOverrides'][string]>>) => {
      patchLocalState((current) => ({
        ...current,
        libraryOverrides: {
          ...current.libraryOverrides,
          [fileId]: {
            ...current.libraryOverrides[fileId],
            ...patch,
          },
        },
      }))
    },
    [patchLocalState],
  )

  const handleCardNavigate = useCallback((card: OverviewMetricCard) => {
    if (!card.targetSection) return
    setSection(card.targetSection)
    if (card.targetSection === 'users') {
      setUsersView('list')
      setUsersFilters((current) => ({
        ...current,
        activityFilter: (card.targetFilter?.recent as '24h' | '7d' | undefined) ?? 'all',
        overQuotaFilter: card.targetFilter?.onlyOverQuota === 'true' ? 'yes' : 'all',
      }))
    }
    if (card.targetSection === 'library') {
      setLibraryView('list')
      setSelectedLibraryScope({ type: 'all', key: 'all' })
    }
    if (card.targetSection === 'quotas') {
      setQuotaRangePreset((card.targetFilter?.range as 'today' | '7d' | '30d') ?? '30d')
    }
  }, [])

  const handleIncidentNavigate = useCallback((row: { targetSection?: AdminSection; targetId?: string; tone?: EventLevel }) => {
    setSection(row.targetSection ?? 'system')
    if (row.targetSection === 'users' && row.targetId) {
      openUserDetail(row.targetId)
    }
    if (row.targetSection === 'library' && row.targetId) {
      openLibraryDetail(row.targetId)
    }
    if (row.targetSection === 'models' && row.targetId) {
      setActiveProviderId(row.targetId)
    }
    if (row.targetSection === 'quotas' && row.tone) {
      setQuotaRangePreset('today')
    }
  }, [openLibraryDetail, openUserDetail])

  const handlePreviewFile = useCallback((item: LibraryRecord) => {
    openLibraryDetail(item.id)
  }, [openLibraryDetail])

  const handleReindexFile = useCallback(
    (item: LibraryRecord) => {
      patchLibraryRecord(item.id, {
        status: 'indexed',
        lastReferencedAt: new Date().toISOString(),
      })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '重新索引文件' : 'Reindexed file',
        target: item.name,
        targetType: 'file',
        detail:
          locale === 'zh-CN'
            ? `文件 ${item.name} 已重新索引并恢复到正常状态。`
            : `File ${item.name} was reindexed and restored to a healthy state.`,
        result: 'success',
      })
    },
    [appendLog, locale, patchLibraryRecord, session.name],
  )

  const handleMarkFileAbnormal = useCallback(
    (item: LibraryRecord) => {
      patchLibraryRecord(item.id, { status: 'error' })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '标记文件异常' : 'Marked file abnormal',
        target: item.name,
        targetType: 'file',
        detail:
          locale === 'zh-CN'
            ? `文件 ${item.name} 已标记为索引失败，等待后续处理。`
            : `File ${item.name} was marked as requiring attention after an indexing issue.`,
        result: 'warning',
      })
    },
    [appendLog, locale, patchLibraryRecord, session.name],
  )

  const handleDeleteFile = useCallback(
    (item: LibraryRecord) => {
      patchLibraryRecord(item.id, { status: 'deleted' })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '删除文件' : 'Deleted file',
        target: item.name,
        targetType: 'file',
        detail:
          locale === 'zh-CN'
            ? `文件 ${item.name} 已从资料库中标记为删除。`
            : `File ${item.name} was marked as deleted in the library.`,
        result: 'warning',
      })
      setConfirmState(null)
    },
    [appendLog, locale, patchLibraryRecord, session.name],
  )

  const saveHosting = useCallback(async () => {
    if (!adminCatalog) return
    try {
      setSavingRouting(true)
      const response = await updateManagedRouting({
        managedRouting: adminCatalog.managedRouting,
        providers: adminCatalog.providers,
      })
      setAdminCatalog(response)
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '更新模型托管' : 'Updated model hosting',
        target: locale === 'zh-CN' ? '路由策略' : 'Routing policy',
        targetType: 'routing',
        detail:
          locale === 'zh-CN'
            ? `普通用户默认模型已更新为 ${response.managedRouting.userDefaultModel}。`
            : `Default user model updated to ${response.managedRouting.userDefaultModel}.`,
        result: 'success',
      })
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '保存模型托管失败。'
            : 'Unable to save hosting changes.',
      )
    } finally {
      setSavingRouting(false)
    }
  }, [adminCatalog, appendLog, locale, session.name])

  const savePolicies = useCallback(async () => {
    if (!adminCatalog) return
    try {
      setSavingPolicies(true)
      const permissions = await updatePermissions(adminCatalog.permissions)
      setAdminCatalog((current) => (current ? { ...current, permissions } : current))
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '更新权限策略' : 'Updated policies',
        target: locale === 'zh-CN' ? '平台默认策略' : 'Platform policy',
        targetType: 'policy',
        detail:
          locale === 'zh-CN'
            ? '平台默认能力开关与访问策略已更新并立即生效。'
            : 'Platform defaults and access policies were updated and applied immediately.',
        result: 'success',
      })
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '保存策略失败。'
            : 'Unable to save policies.',
      )
    } finally {
      setSavingPolicies(false)
    }
  }, [adminCatalog, appendLog, locale, session.name])

  const handleTestProvider = useCallback(
    async (providerId: string) => {
      try {
        setTestingProviderId(providerId)
        const response = await testProvider(providerId)
        setProviderTestResult({
          providerId,
          detail: response.detail,
          latencyMs: response.latency_ms ?? null,
          checkedAt: response.checked_at ?? null,
        })
        setAdminCatalog((current) =>
          current
            ? {
                ...current,
                providers: current.providers.map((provider) =>
                  provider.id === providerId
                    ? {
                        ...provider,
                        status: response.provider.status,
                        lastCheckedAt: response.checked_at ?? response.provider.last_checked_at ?? null,
                        lastPingMs: response.latency_ms ?? null,
                        lastErrorReason: response.provider.status === 'healthy' ? null : response.detail,
                      }
                    : provider,
                ),
              }
            : current,
        )
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '测试服务商连通性' : 'Tested provider',
          target: providerId,
          targetType: 'provider',
          detail:
            locale === 'zh-CN'
              ? `${providerId} 连通性测试完成${response.latency_ms ? `，Ping ${response.latency_ms}ms。` : '。'}`
              : `Connectivity test completed for ${providerId}${response.latency_ms ? `, ping ${response.latency_ms}ms.` : '.'}`,
          result: response.provider.status === 'healthy' ? 'success' : 'warning',
        })
        setError(null)
        void loadData()
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '测试服务商失败。'
              : 'Provider test failed.'
        setProviderTestResult({
          providerId,
          detail: message,
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        })
        setError(message)
      } finally {
        setTestingProviderId(null)
      }
    },
    [appendLog, loadData, locale, session.name],
  )

  const handleSyncProvider = useCallback(
    async (providerId: string) => {
      try {
        setSyncingProviderId(providerId)
        const response = await syncProvider(providerId)
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '同步服务商模型' : 'Synced provider catalog',
          target: providerId,
          targetType: 'provider',
          detail:
            locale === 'zh-CN'
              ? `已同步 ${response.model_count} 个模型，新增 ${response.created_count} 个，更新 ${response.updated_count} 个。`
              : `Synced ${response.model_count} models, created ${response.created_count}, updated ${response.updated_count}.`,
          result: response.status === 'success' ? 'success' : 'warning',
        })
        setError(response.status === 'success' ? null : response.detail)
        await loadData()
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '同步服务商模型失败。'
              : 'Unable to sync provider catalog.',
        )
      } finally {
        setSyncingProviderId(null)
      }
    },
    [appendLog, loadData, locale, session.name],
  )

  const handleDeleteProvider = useCallback(
    async (provider: ProviderRegistryItem) => {
      try {
        setBusy(true)
        await deleteProvider(provider.id)
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '删除服务商' : 'Deleted provider',
          target: provider.name,
          targetType: 'provider',
          detail:
            locale === 'zh-CN'
              ? `已删除服务商 ${provider.name} 及其下游模型，并自动修复默认路由。`
              : `Deleted provider ${provider.name} and its models; defaults were repaired automatically.`,
          result: 'warning',
        })
        setConfirmState(null)
        await loadData()
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '删除服务商失败。'
              : 'Unable to delete provider.',
        )
      } finally {
        setBusy(false)
      }
    },
    [appendLog, loadData, locale, session.name],
  )

  const handleDeleteModel = useCallback(
    async (model: ModelRegistryItem) => {
      try {
        setBusy(true)
        await deleteModel(model.id)
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '删除模型' : 'Deleted model',
          target: model.displayName,
          targetType: 'model',
          detail:
            locale === 'zh-CN'
              ? `已删除模型 ${model.displayName}，并自动修复默认路由和 fallback 引用。`
              : `Deleted model ${model.displayName}; defaults and fallback references were repaired automatically.`,
          result: 'warning',
        })
        setConfirmState(null)
        await loadData()
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '删除模型失败。'
              : 'Unable to delete model.',
        )
      } finally {
        setBusy(false)
      }
    },
    [appendLog, loadData, locale, session.name],
  )

  const handleToggleUser = useCallback(
    async (user: AdminUserRecord) => {
      try {
        setBusy(true)
        const nextStatus = user.status === 'active' ? 'suspended' : 'active'
        if (user.isLocalOnly) {
          updateUserRecord(user, { status: nextStatus })
        } else if (user.status === 'active') {
          await disableUser(user.userId)
          await loadData()
        } else {
          await enableUser(user.userId)
          await loadData()
        }
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '变更用户状态' : 'Changed user status',
          target: user.email,
          targetType: 'user',
          detail:
            locale === 'zh-CN'
              ? `${user.name} 的账户状态已更新为 ${nextStatus === 'active' ? '启用' : '暂停'}。`
              : `${user.name} status changed to ${nextStatus}.`,
          result: 'success',
        })
        setConfirmState(null)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '更新用户状态失败。'
              : 'Unable to update user status.',
        )
      } finally {
        setBusy(false)
      }
    },
    [appendLog, loadData, locale, session.name, updateUserRecord],
  )

  const handleDeleteUser = useCallback(
    async (user: AdminUserRecord) => {
      try {
        setBusy(true)
        if (user.isLocalOnly) {
          patchLocalState((current) => ({
            ...current,
            localUsers: current.localUsers.filter((entry) => entry.userId !== user.userId),
          }))
        } else {
          await deleteUser(user.userId)
          await loadData()
        }
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '删除用户' : 'Deleted user',
          target: user.email,
          targetType: 'user',
          detail:
            locale === 'zh-CN'
              ? `${user.name} 已从后台中移除。`
              : `${user.name} was removed from the control plane.`,
          result: 'warning',
        })
        setConfirmState(null)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '删除用户失败。'
              : 'Unable to delete user.',
        )
      } finally {
        setBusy(false)
      }
    },
    [appendLog, loadData, locale, patchLocalState, session.name],
  )

  const handleResetPassword = useCallback(
    async (user: AdminUserRecord, mode: 'temporary' | 'link') => {
      try {
        setBusy(true)
        if (!user.isLocalOnly && mode === 'temporary') {
          await resetUserPassword(user.userId, 'Temp123456!')
        }
        appendLog({
          actor: session.name,
          actorRole: 'admin',
          actionType: locale === 'zh-CN' ? '重置密码' : 'Reset password',
          target: user.email,
          targetType: 'user',
          detail:
            locale === 'zh-CN'
              ? mode === 'temporary'
                ? `已为 ${user.name} 生成临时密码。`
                : `已为 ${user.name} 生成重置链接事件。`
              : mode === 'temporary'
                ? `Generated temporary password for ${user.name}.`
                : `Generated reset-link event for ${user.name}.`,
          result: 'success',
        })
        setConfirmState(null)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : locale === 'zh-CN'
              ? '重置密码失败。'
              : 'Unable to reset password.',
        )
      } finally {
        setBusy(false)
      }
    },
    [appendLog, locale, session.name],
  )

  const handleCreateUser = useCallback(async () => {
    if (!adminCatalog) return
    try {
      const nextUser: AdminUserRecord = createDraft.password.trim()
        ? ({
            ...createUserSeed(createDraft, adminCatalog.permissions, adminCatalog),
            ...(await createUser(createDraft)),
            isLocalOnly: false,
            status: 'active',
          } as AdminUserRecord)
        : createUserSeed(createDraft, adminCatalog.permissions, adminCatalog)
      patchLocalState((current) =>
        nextUser.isLocalOnly
          ? {
              ...current,
              localUsers: [nextUser, ...current.localUsers],
            }
          : current,
      )
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '创建用户' : 'Created user',
        target: nextUser.email,
        targetType: 'user',
        detail:
          locale === 'zh-CN'
            ? `已创建 ${nextUser.role === 'admin' ? '管理员' : '普通用户'}账户 ${nextUser.name}。`
            : `Created ${nextUser.role} account for ${nextUser.name}.`,
        result: 'success',
      })
      setSelectedUserId(nextUser.userId)
      setUsersView('detail')
      setSection('users')
      setCreateDraft({ name: '', email: '', password: '', role: 'user' })
      setCreateOpen(false)
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '创建用户失败。'
            : 'Unable to create user.',
      )
    }
  }, [adminCatalog, appendLog, createDraft, loadData, locale, patchLocalState, session.name])

  const handleCreateProvider = useCallback(async () => {
    try {
      setCreatingProvider(true)
      const providerId = slugify(providerDraft.id || providerDraft.name)
      await createProvider({
        id: providerId,
        name: providerDraft.name.trim(),
        type: providerDraft.type,
        baseUrl: providerDraft.baseUrl.trim(),
        apiKey: providerDraft.apiKey.trim(),
        description: providerDraft.description.trim(),
        enabled: true,
        visibleToUsers: true,
      })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '新增服务商' : 'Created provider',
        target: providerDraft.name.trim(),
        targetType: 'provider',
        detail:
          locale === 'zh-CN'
            ? `已新增服务商 ${providerDraft.name.trim()}。`
            : `Created provider ${providerDraft.name.trim()}.`,
        result: 'success',
      })
      setProviderDraft({
        id: '',
        name: '',
        type: 'qwen',
        baseUrl: '',
        apiKey: '',
        description: '',
      })
      setCreateProviderOpen(false)
      setActiveProviderId(providerId)
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '新增服务商失败。'
            : 'Unable to create provider.',
      )
    } finally {
      setCreatingProvider(false)
    }
  }, [appendLog, loadData, locale, providerDraft, session.name, slugify])

  const handleCreateModel = useCallback(async () => {
    try {
      setCreatingModel(true)
      const modelId = slugify(modelDraft.id || modelDraft.internalName || modelDraft.displayName)
      await createModel({
        id: modelId,
        providerId: modelDraft.providerId,
        displayName: modelDraft.displayName.trim(),
        internalName: modelDraft.internalName.trim() || modelId,
        type: modelDraft.type,
        inputPricePer1k: Number(modelDraft.inputPricePer1k || 0),
        outputPricePer1k: Number(modelDraft.outputPricePer1k || 0),
        imagePricePerCall: Number(modelDraft.imagePricePerCall || 0),
        priority: Number(modelDraft.priority || 0),
        contextWindow: modelDraft.contextWindow ? Number(modelDraft.contextWindow) : undefined,
        tags: modelDraft.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '新增模型' : 'Created model',
        target: modelDraft.displayName.trim(),
        targetType: 'model',
        detail:
          locale === 'zh-CN'
            ? `已新增模型 ${modelDraft.displayName.trim()}。`
            : `Created model ${modelDraft.displayName.trim()}.`,
        result: 'success',
      })
      setModelDraft({
        id: '',
        providerId: activeProviderId,
        displayName: '',
        internalName: '',
        type: 'chat',
        inputPricePer1k: '0',
        outputPricePer1k: '0',
        imagePricePerCall: '0',
        priority: '0',
        contextWindow: '',
        tags: '',
      })
      setCreateModelOpen(false)
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === 'zh-CN'
            ? '新增模型失败。'
            : 'Unable to create model.',
      )
    } finally {
      setCreatingModel(false)
    }
  }, [activeProviderId, appendLog, loadData, locale, modelDraft, session.name, slugify])

  const handleBulkUpdate = useCallback(
    (userIds: string[], action: 'activate' | 'suspend' | 'block' | 'quota' | 'models' | 'auto-model') => {
      if (!snapshot) return
      const nextModelIds = snapshot.models.filter((model) => model.visibleToUsers).slice(0, snapshot.quotas.defaultModelLimit).map((model) => model.id)
      userIds.forEach((userId) => {
        const user = snapshot.users.find((entry) => entry.userId === userId)
        if (!user) return
        if (action === 'activate') {
          updateUserRecord(user, { status: 'active' })
          return
        }
        if (action === 'suspend') {
          updateUserRecord(user, { status: 'suspended' })
          return
        }
        if (action === 'block') {
          updateUserRecord(user, { status: 'blocked' })
          return
        }
        if (action === 'quota') {
          updateUserRecord(user, {
            tokenQuotaDaily: snapshot.quotas.defaultDailyTokenLimit,
            tokenQuotaMonthly: snapshot.quotas.defaultMonthlyTokenLimit,
            requestLimitDaily: snapshot.quotas.defaultRequestLimitDaily,
            maxRequestTokens: snapshot.quotas.defaultMaxRequestTokens,
          })
          return
        }
        if (action === 'models') {
          updateUserRecord(user, {
            allowedModelIds: nextModelIds,
            maxSelectableModels: snapshot.quotas.defaultModelLimit,
          })
          return
        }
        updateUserRecord(user, {
          autoModelSelectionEnabled: !user.autoModelSelectionEnabled,
        })
      })
      appendLog({
        actor: session.name,
        actorRole: 'admin',
        actionType: locale === 'zh-CN' ? '批量用户操作' : 'Bulk user action',
        target: `${userIds.length} ${locale === 'zh-CN' ? '个用户' : 'users'}`,
        targetType: 'user',
        detail:
          locale === 'zh-CN'
            ? `已对 ${userIds.length} 个用户执行 ${action}。`
            : `Applied ${action} to ${userIds.length} users.`,
        result: 'success',
      })
    },
    [appendLog, locale, session.name, snapshot, updateUserRecord],
  )

  const renderSection = () => {
    if (!snapshot || !adminCatalog) {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-muted shadow-panel">
          {locale === 'zh-CN' ? '正在加载管理后台...' : 'Loading control plane...'}
        </div>
      )
    }

    switch (section) {
      case 'overview':
        return (
          <OverviewDashboard
            data={snapshot.overview}
            formatDate={formatDate}
            onCardNavigate={handleCardNavigate}
            onIncidentNavigate={handleIncidentNavigate}
            refreshing={refreshing}
          />
        )
      case 'users':
        return usersView === 'detail' ? (
          <UserDetailPanel
            user={selectedUser}
            quotas={snapshot.quotas}
            onBack={returnToUsersList}
            onUpdateUser={(patch) => selectedUser && updateUserRecord(selectedUser, patch)}
            onResetPassword={(user, mode) => setConfirmState({ type: 'reset-password', user, mode })}
            onToggleUser={(user) => setConfirmState({ type: 'toggle-user', user })}
            onDeleteUser={(user) => setConfirmState({ type: 'delete-user', user })}
          />
        ) : (
          <UsersTable
            users={snapshot.users}
            searchValue={searchValue}
            selectedUserId={selectedUserId}
            filters={usersFilters}
            onFiltersChange={(patch) => setUsersFilters((current) => ({ ...current, ...patch }))}
            onSelectUser={openUserDetail}
            onCreateUser={() => setCreateOpen(true)}
            onEditPermissions={(user) => openUserDetail(user.userId)}
            onResetPassword={(user) => setConfirmState({ type: 'reset-password', user, mode: 'temporary' })}
            onToggleUser={(user) => setConfirmState({ type: 'toggle-user', user })}
            onDeleteUser={(user) => setConfirmState({ type: 'delete-user', user })}
            onBulkUpdate={handleBulkUpdate}
          />
        )
      case 'models':
        return (
          <div className="space-y-4">
            <ModelsPanel
              providers={snapshot.providers}
              models={snapshot.models}
              routing={snapshot.routing}
              activeProviderId={activeProviderId}
              onActiveProviderChange={setActiveProviderId}
              onCreateProvider={() => setCreateProviderOpen(true)}
              onCreateModel={(providerId) => {
                setModelDraft((current) => ({ ...current, providerId }))
                setCreateModelOpen(true)
              }}
              onProviderPatch={(providerId, patch) => {
                patchProviderDraft(providerId, patch)
                if (patch.configuredModel) {
                  patchRouting({
                    userDefaultProvider: providerId,
                    userDefaultModel: patch.configuredModel,
                  })
                }
              }}
              onModelPatch={(modelId, patch) => patchModelOverride(modelId, patch)}
              onRoutingPatch={(patch) => {
                const routingPatch: Partial<ManagedRoutingState> = {}
                if (patch.userDefaultProvider) routingPatch.userDefaultProvider = patch.userDefaultProvider
                if (patch.userDefaultModel) routingPatch.userDefaultModel = patch.userDefaultModel
                if (patch.adminDefaultProvider) routingPatch.adminDefaultProvider = patch.adminDefaultProvider
                if (patch.adminDefaultModel) routingPatch.adminDefaultModel = patch.adminDefaultModel
                if (typeof patch.allowUserModelSwitch === 'boolean') {
                  routingPatch.allowUserModelSwitch = patch.allowUserModelSwitch
                }
                if (Object.keys(routingPatch).length) patchRouting(routingPatch)
                patchLocalState((current) => ({
                  ...current,
                  routingPolicy: {
                    ...current.routingPolicy,
                    autoRoutingEnabled:
                      patch.autoRoutingEnabled ?? current.routingPolicy.autoRoutingEnabled,
                    autoRoutingStrategy:
                      patch.autoRoutingStrategy ?? current.routingPolicy.autoRoutingStrategy,
                    fallbackModelId:
                      patch.fallbackModelId ?? current.routingPolicy.fallbackModelId,
                  },
                }))
              }}
              onTestProvider={handleTestProvider}
              onSyncProvider={handleSyncProvider}
              onDeleteProvider={(provider) => setConfirmState({ type: 'delete-provider', provider })}
              onDeleteModel={(model) => setConfirmState({ type: 'delete-model', model })}
              testingProviderId={testingProviderId}
              syncingProviderId={syncingProviderId}
              providerTestResult={providerTestResult}
              onSaveProviderConfig={() => {
                void saveHosting()
              }}
              onRestoreRouting={() =>
                patchLocalState((current) => ({
                  ...current,
                  routingPolicy: {
                    autoRoutingEnabled: true,
                    autoRoutingStrategy: 'quality',
                    fallbackModelId: snapshot.routing.userDefaultModel,
                  },
                }))
              }
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-subtle">
                {localState.lastSavedAt
                  ? `${text.saveSuccess} · ${formatDate(localState.lastSavedAt)}`
                  : ' '}
              </p>
              <button
                type="button"
                onClick={() => {
                  void saveHosting()
                }}
                disabled={savingRouting}
                className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
              >
                {savingRouting ? text.savingRouting : text.saveRouting}
              </button>
            </div>
          </div>
        )
      case 'quotas':
        return (
          <QuotaSettingsPanel
            quotas={snapshot.quotas}
            users={snapshot.users}
            billing={snapshot.billing}
            presetRange={quotaRangePreset}
            onChange={(patch) =>
              patchLocalState((current) => ({
                ...current,
                platformPolicy: { ...current.platformPolicy, ...patch },
              }))
            }
            onApplyUserOverrides={(userId, patch) => {
              const user = snapshot.users.find((entry) => entry.userId === userId)
              if (!user) return
              updateUserRecord(user, patch)
            }}
          />
        )
      case 'library':
        return libraryView === 'detail' ? (
          <LibraryDetailView
            item={selectedLibrary}
            onBack={returnToLibraryList}
            onPreview={handlePreviewFile}
            onReindex={handleReindexFile}
            onMarkAbnormal={handleMarkFileAbnormal}
            onDelete={(file) => setConfirmState({ type: 'delete-file', file })}
          />
        ) : (
          <LibraryTable
            items={snapshot.library}
            searchValue={searchValue}
            filters={libraryFilters}
            selectedScope={selectedLibraryScope}
            selectedFileId={selectedLibraryId}
            onFiltersChange={(patch) => setLibraryFilters((current) => ({ ...current, ...patch }))}
            onSelectScope={handleSelectLibraryScope}
            onSelectFile={openLibraryDetail}
            onPreviewFile={handlePreviewFile}
            onReindexFile={handleReindexFile}
            onDeleteFile={(file) => setConfirmState({ type: 'delete-file', file })}
          />
        )
      case 'system':
        return (
          <SystemHealthPanel
            providers={snapshot.providers}
            incidents={snapshot.overview.incidents}
            recentActivity={snapshot.recentActivity}
          />
        )
      case 'policies':
        return (
          <div className="space-y-4">
            <PoliciesPanel
              permissions={snapshot.policies}
              quotas={snapshot.quotas}
              onPermissionChange={(patch) =>
                setAdminCatalog((current) =>
                  current ? { ...current, permissions: { ...current.permissions, ...patch } } : current,
                )
              }
              onQuotaPolicyChange={(patch) =>
                patchLocalState((current) => ({
                  ...current,
                  platformPolicy: { ...current.platformPolicy, ...patch },
                }))
              }
              onSave={() => {
                void savePolicies()
              }}
              saving={savingPolicies}
            />
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
                {locale === 'zh-CN' ? '变更影响分析' : 'Change impact'}
              </h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                    {locale === 'zh-CN' ? '影响用户' : 'Affected users'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{snapshot.users.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                    {locale === 'zh-CN' ? '影响模型' : 'Affected models'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {snapshot.models.filter((model) => model.visibleToUsers).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                    {locale === 'zh-CN' ? '生效方式' : 'Activation'}
                  </p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {locale === 'zh-CN' ? '立即生效' : 'Immediate'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      case 'logs':
        return <AuditLogTable logs={snapshot.logs} searchValue={searchValue} />
      default:
        return null
    }
  }

  return (
    <>
      <AdminLayout
        navItems={navItems}
        activeSection={section}
        session={session}
        title={displayMeta.title}
        description={displayMeta.description}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
          onSectionChange={(nextSection) => {
            setSection(nextSection)
            if (nextSection === 'users') setUsersView('list')
            if (nextSection === 'library') setLibraryView('list')
          }}
        onLogout={onLogout}
        action={
          <div className="flex items-center gap-2">
            {section === 'users' && usersView === 'list' ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-50"
              >
                <Plus size={15} />
                {text.createUser}
              </button>
            ) : null}
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                void loadData({ probeProviders: true })
              }}
              className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
            >
              {refreshing ? text.refreshing : text.refresh}
            </button>
            {lastUpdatedAt ? (
              <span className="text-xs text-subtle">
                {text.refreshedAt} · {formatDate(lastUpdatedAt)}
              </span>
            ) : null}
          </div>
        }
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {renderSection()}
      </AdminLayout>

      {createOpen && adminCatalog ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/26 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-2xl font-semibold tracking-[-0.03em] text-ink">{text.createUserTitle}</h3>
            <p className="mt-2 text-sm leading-7 text-muted">{text.createUserHint}</p>
            <div className="mt-5 grid gap-4">
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">{text.name}</span>
                <input
                  value={createDraft.name}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">{text.email}</span>
                <input
                  value={createDraft.email}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">{text.password}</span>
                <input
                  type="password"
                  value={createDraft.password}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">{text.role}</span>
                <select
                  value={createDraft.role}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, role: event.target.value as 'admin' | 'user' }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="user">{locale === 'zh-CN' ? '普通用户' : 'User'}</option>
                  <option value="admin">{locale === 'zh-CN' ? '管理员' : 'Admin'}</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateUser()
                }}
                disabled={!createDraft.name.trim() || !createDraft.email.trim()}
                className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
              >
                {text.create}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createProviderOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/26 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
              {locale === 'zh-CN' ? '新增服务商' : 'Create provider'}
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted">
              {locale === 'zh-CN'
                ? '创建新的模型服务商接入，并写入真实后台配置。'
                : 'Create a new provider entry and persist it to the control plane.'}
            </p>
            <div className="mt-5 grid gap-4">
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">ID</span>
                <input
                  value={providerDraft.id}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, id: event.target.value }))}
                  placeholder={locale === 'zh-CN' ? '留空则按名称自动生成' : 'Leave empty to auto-generate'}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '名称' : 'Name'}
                </span>
                <input
                  value={providerDraft.name}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                    {locale === 'zh-CN' ? '类型' : 'Type'}
                  </span>
                  <select
                    value={providerDraft.type}
                    onChange={(event) =>
                      setProviderDraft((current) => ({
                        ...current,
                        type: event.target.value as typeof providerDraft.type,
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    <option value="qwen">Qwen</option>
                    <option value="openai">OpenAI</option>
                    <option value="openai_compatible">OpenAI Compatible</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">{locale === 'zh-CN' ? '自定义' : 'Custom'}</option>
                    <option value="mock">Mock</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                    {locale === 'zh-CN' ? '描述' : 'Description'}
                  </span>
                  <input
                    value={providerDraft.description}
                    onChange={(event) =>
                      setProviderDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                  />
                </label>
              </div>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">Base URL</span>
                <input
                  value={providerDraft.baseUrl}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">API Key</span>
                <input
                  value={providerDraft.apiKey}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateProviderOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateProvider()
                }}
                disabled={!providerDraft.name.trim()}
                className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
              >
                {creatingProvider
                  ? locale === 'zh-CN'
                    ? '创建中...'
                    : 'Creating...'
                  : locale === 'zh-CN'
                    ? '创建服务商'
                    : 'Create provider'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createModelOpen && adminCatalog ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/26 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
              {locale === 'zh-CN' ? '新增模型' : 'Create model'}
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted">
              {locale === 'zh-CN'
                ? '把新模型挂到服务商下，并立即纳入平台模型池。'
                : 'Attach a new model to a provider and register it in the platform pool.'}
            </p>
            <label className="mt-5 block rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                {locale === 'zh-CN' ? '从同步清单选择' : 'Pick from synced catalog'}
              </span>
              <select
                value=""
                onChange={(event) => {
                  const selected = adminCatalog.providers
                    .find((provider) => provider.id === modelDraft.providerId)
                    ?.models.find((model) => model.id === event.target.value)
                  if (!selected) return
                  setModelDraft((current) => ({
                    ...current,
                    id: selected.id,
                    displayName: selected.label,
                    internalName: selected.id,
                    type: (selected.type as typeof current.type | null) ?? current.type,
                    contextWindow: selected.contextWindow ? String(selected.contextWindow) : current.contextWindow,
                    tags: selected.tags.join(', '),
                    inputPricePer1k:
                      typeof selected.inputPricePer1k === 'number'
                        ? String(selected.inputPricePer1k)
                        : current.inputPricePer1k,
                    outputPricePer1k:
                      typeof selected.outputPricePer1k === 'number'
                        ? String(selected.outputPricePer1k)
                        : current.outputPricePer1k,
                  }))
                }}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="">
                  {locale === 'zh-CN' ? '选择一个已同步模型，或继续手动填写' : 'Select a synced model, or keep filling manually'}
                </option>
                {adminCatalog.providers
                  .find((provider) => provider.id === modelDraft.providerId)
                  ?.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} ({model.id})
                    </option>
                  ))}
              </select>
            </label>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">ID</span>
                <input
                  value={modelDraft.id}
                  onChange={(event) => setModelDraft((current) => ({ ...current, id: event.target.value }))}
                  placeholder={locale === 'zh-CN' ? '留空则按模型名自动生成' : 'Leave empty to auto-generate'}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '所属服务商' : 'Provider'}
                </span>
                <select
                  value={modelDraft.providerId}
                  onChange={(event) => setModelDraft((current) => ({ ...current, providerId: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  {snapshot?.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '显示名' : 'Display name'}
                </span>
                <input
                  value={modelDraft.displayName}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, displayName: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '内部名' : 'Internal name'}
                </span>
                <input
                  value={modelDraft.internalName}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, internalName: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '模型类型' : 'Model type'}
                </span>
                <select
                  value={modelDraft.type}
                  onChange={(event) =>
                    setModelDraft((current) => ({
                      ...current,
                      type: event.target.value as typeof modelDraft.type,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="chat">Chat</option>
                  <option value="vision">Vision</option>
                  <option value="image">Image</option>
                  <option value="embedding">Embedding</option>
                  <option value="audio">Audio</option>
                </select>
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '标签（逗号分隔）' : 'Tags'}
                </span>
                <input
                  value={modelDraft.tags}
                  onChange={(event) => setModelDraft((current) => ({ ...current, tags: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '输入单价 / 1k' : 'Input price / 1k'}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={modelDraft.inputPricePer1k}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, inputPricePer1k: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '输出单价 / 1k' : 'Output price / 1k'}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={modelDraft.outputPricePer1k}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, outputPricePer1k: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '调用单价' : 'Call price'}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={modelDraft.imagePricePerCall}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, imagePricePerCall: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '优先级' : 'Priority'}
                </span>
                <input
                  type="number"
                  value={modelDraft.priority}
                  onChange={(event) => setModelDraft((current) => ({ ...current, priority: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                  {locale === 'zh-CN' ? '上下文长度' : 'Context window'}
                </span>
                <input
                  type="number"
                  value={modelDraft.contextWindow}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, contextWindow: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateModelOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateModel()
                }}
                disabled={!modelDraft.displayName.trim() || !modelDraft.providerId}
                className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
              >
                {creatingModel
                  ? locale === 'zh-CN'
                    ? '创建中...'
                    : 'Creating...'
                  : locale === 'zh-CN'
                    ? '创建模型'
                    : 'Create model'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.type === 'delete-user'
            ? text.dialog.deleteTitle
            : confirmState?.type === 'delete-file'
              ? text.dialog.deleteFileTitle
            : confirmState?.type === 'delete-provider'
              ? locale === 'zh-CN'
                ? '删除这个服务商？'
                : 'Delete this provider?'
            : confirmState?.type === 'delete-model'
              ? locale === 'zh-CN'
                ? '删除这个模型？'
                : 'Delete this model?'
            : confirmState?.type === 'toggle-user'
              ? text.dialog.toggleTitle
              : text.dialog.resetTitle
        }
        description={
          confirmState?.type === 'delete-user'
            ? text.dialog.deleteBody
            : confirmState?.type === 'delete-file'
              ? text.dialog.deleteFileBody
            : confirmState?.type === 'delete-provider'
              ? locale === 'zh-CN'
                ? '这会软删除服务商及其下所有模型，并自动修复默认模型和 fallback 引用。'
                : 'This soft-deletes the provider and all of its models, then repairs defaults and fallback references.'
            : confirmState?.type === 'delete-model'
              ? locale === 'zh-CN'
                ? '这会软删除模型，并自动修复默认模型和 fallback 引用。'
                : 'This soft-deletes the model, then repairs defaults and fallback references.'
            : confirmState?.type === 'toggle-user'
              ? text.dialog.toggleBody
              : confirmState?.mode === 'link'
                ? text.dialog.resetBodyLink
                : text.dialog.resetBodyTemporary
        }
        confirmLabel={
          confirmState?.type === 'delete-user'
            ? text.dialog.deleteConfirm
            : confirmState?.type === 'delete-file'
              ? text.dialog.deleteFileConfirm
            : confirmState?.type === 'delete-provider'
              ? locale === 'zh-CN'
                ? '删除服务商'
                : 'Delete provider'
            : confirmState?.type === 'delete-model'
              ? locale === 'zh-CN'
                ? '删除模型'
                : 'Delete model'
            : confirmState?.type === 'toggle-user'
              ? text.dialog.toggleConfirm
              : confirmState?.mode === 'link'
                ? text.dialog.resetConfirmLink
                : text.dialog.resetConfirmTemporary
        }
        tone={
          confirmState?.type === 'delete-user' ||
          confirmState?.type === 'delete-file' ||
          confirmState?.type === 'delete-provider' ||
          confirmState?.type === 'delete-model'
            ? 'danger'
            : 'default'
        }
        busy={busy}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) return
          if (confirmState.type === 'delete-user') {
            void handleDeleteUser(confirmState.user)
            return
          }
          if (confirmState.type === 'delete-file') {
            handleDeleteFile(confirmState.file)
            return
          }
          if (confirmState.type === 'delete-provider') {
            void handleDeleteProvider(confirmState.provider)
            return
          }
          if (confirmState.type === 'delete-model') {
            void handleDeleteModel(confirmState.model)
            return
          }
          if (confirmState.type === 'toggle-user') {
            void handleToggleUser(confirmState.user)
            return
          }
          void handleResetPassword(confirmState.user, confirmState.mode)
        }}
      />
    </>
  )
}
