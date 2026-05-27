import clsx from 'clsx'
import {
  Check,
  ChevronRight,
  Info,
  Languages,
  Layers3,
  LogOut,
  Mic,
  Pencil,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AuthSession } from '../../types/auth'
import type { Conversation, UserPermissionPolicy } from '../../types/chat'
import type { LibraryItem } from '../../types/library'
import type { WorkspaceSummary } from '../../types/chat'
import { LanguageSwitcher } from '../common/LanguageSwitcher'
import { LayoutModeSwitcher } from '../common/LayoutModeSwitcher'

type MobilePanel = 'conversations' | 'models' | 'tools' | 'account' | null

const mobileCopy = {
  'zh-CN': {
    todayTokens: '今日 Token',
    conversations: '会话',
    models: '模型',
    tools: '工具',
    account: '账户',
    library: '资料库',
    settings: '设置',
    voice: '语音',
    workspace: '工作台',
    logout: '退出登录',
    openSettings: '打开偏好设置',
    openWorkspace: '查看工作台信息',
    noFiles: '还没有上传资料。',
    switchModel: '切换模型',
    activeModel: '当前模型',
    availableModels: '管理员开放的模型池',
    rename: '重命名',
    remove: '删除',
    pickLanguage: '语言',
    interfaceMode: '界面模式',
  },
  'en-US': {
    todayTokens: 'Today tokens',
    conversations: 'Chats',
    models: 'Models',
    tools: 'Tools',
    account: 'Account',
    library: 'Library',
    settings: 'Settings',
    voice: 'Voice',
    workspace: 'Workspace',
    logout: 'Log out',
    openSettings: 'Open preferences',
    openWorkspace: 'Open workspace info',
    noFiles: 'No uploaded files yet.',
    switchModel: 'Switch model',
    activeModel: 'Current model',
    availableModels: 'Managed model pool',
    rename: 'Rename',
    remove: 'Delete',
    pickLanguage: 'Language',
    interfaceMode: 'Layout',
  },
  'ja-JP': {
    todayTokens: '今日の Token',
    conversations: '会話',
    models: 'モデル',
    tools: 'ツール',
    account: 'アカウント',
    library: 'ライブラリ',
    settings: '設定',
    voice: '音声',
    workspace: 'ワークスペース',
    logout: 'ログアウト',
    openSettings: '設定を開く',
    openWorkspace: 'ワークスペース情報',
    noFiles: 'まだアップロードはありません。',
    switchModel: 'モデルを切り替え',
    activeModel: '現在のモデル',
    availableModels: '管理対象モデル',
    rename: '名前を変更',
    remove: '削除',
    pickLanguage: '言語',
    interfaceMode: '表示モード',
  },
  'es-ES': {
    todayTokens: 'Tokens hoy',
    conversations: 'Chats',
    models: 'Modelos',
    tools: 'Herramientas',
    account: 'Cuenta',
    library: 'Biblioteca',
    settings: 'Ajustes',
    voice: 'Voz',
    workspace: 'Espacio',
    logout: 'Cerrar sesión',
    openSettings: 'Abrir preferencias',
    openWorkspace: 'Abrir información del espacio',
    noFiles: 'Aún no hay archivos subidos.',
    switchModel: 'Cambiar modelo',
    activeModel: 'Modelo actual',
    availableModels: 'Modelos gestionados',
    rename: 'Renombrar',
    remove: 'Eliminar',
    pickLanguage: 'Idioma',
    interfaceMode: 'Diseño',
  },
} as const

export type { MobilePanel }

export type MobileText = (typeof mobileCopy)['en-US']

export function getMobileText(locale: string): MobileText {
  return mobileCopy[locale as keyof typeof mobileCopy] ?? mobileCopy['en-US']
}

export function getModelMetaLabels(locale: string) {
  const labels = {
    'zh-CN': { type: '类型', context: '上下文', tags: '标签', today: '今日进度' },
    'ja-JP': { type: 'タイプ', context: 'コンテキスト', tags: 'タグ', today: '今日' },
    'es-ES': { type: 'Tipo', context: 'Contexto', tags: 'Etiquetas', today: 'Hoy' },
  } as const
  return labels[locale as keyof typeof labels] ?? { type: 'Type', context: 'Context', tags: 'Tags', today: 'Today' }
}

export function getSelectedModelLabel(locale: string) {
  const labels: Record<string, string> = {
    'zh-CN': '已选择',
    'ja-JP': '選択済み',
    'es-ES': 'Seleccionado',
  }
  return labels[locale] ?? 'Selected'
}

interface ModelGroupModel {
  id: string
  label: string
  description?: string | null
  type?: string | null
  contextWindow?: number | null
  tags?: string[]
  inputPricePer1k?: number | null
  outputPricePer1k?: number | null
}

interface ModelGroup {
  providerId: string
  providerLabel: string
  models: ModelGroupModel[]
}

interface ActiveModelMeta {
  providerId: string
  providerLabel: string
  modelId: string
  modelLabel: string
  description?: string | null
}

interface MobileConversationListProps {
  session: AuthSession
  conversations: Conversation[]
  currentConversationId?: string
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onLogout: () => void
  createLabel: string
  renameLabel: string
  removeLabel: string
}

export const MobileConversationList = ({
  session,
  conversations,
  currentConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onLogout,
  createLabel,
  renameLabel,
  removeLabel,
}: MobileConversationListProps) => {
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingConversationId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingConversationId])

  const commitRename = () => {
    if (!editingConversationId) return
    onRenameConversation(editingConversationId, editingTitle)
    setEditingConversationId(null)
    setEditingTitle('')
  }

  const cancelRename = () => {
    setEditingConversationId(null)
    setEditingTitle('')
  }

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onCreateConversation}
        className="mobile-glass-panel flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#171c27] px-4 py-3.5 text-[14px] font-medium text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)]"
      >
        <span>+</span>
        <span>{createLabel}</span>
      </button>

      <div className="space-y-2.5">
        {conversations.map((conversation) => {
          const isActive = conversation.id === currentConversationId
          const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            onDeleteConversation(conversation.id)
          }

          return (
            <div
              key={conversation.id}
              className={clsx(
                'rounded-[24px] border px-4 py-3.5 transition',
                isActive
                  ? 'mobile-glass-panel border-black/8 bg-white/94 shadow-[0_18px_36px_rgba(15,23,42,0.08)]'
                  : 'mobile-soft-panel border-black/5 bg-white/84',
              )}
            >
              <button type="button" onClick={() => onSelectConversation(conversation.id)} className="w-full text-left">
                {editingConversationId === conversation.id ? (
                  <input
                    ref={inputRef}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full rounded-2xl border border-black/7 bg-white/90 px-3 py-2.5 text-[14px] leading-6 text-ink outline-none"
                  />
                ) : (
                  <p className="line-clamp-2 text-[14px] font-medium leading-6 tracking-[-0.015em] text-ink">
                    {conversation.title}
                  </p>
                )}
              </button>

              <div className="mt-3 flex items-center gap-2 text-[12px] text-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setEditingConversationId(conversation.id)
                    setEditingTitle(conversation.title)
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] px-2.5 py-1.5 hover:bg-black/[0.05] hover:text-ink"
                >
                  <Pencil size={12} />
                  <span>{renameLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50/70 px-2.5 py-1.5 text-[rgb(var(--danger))] hover:bg-red-50"
                >
                  <Trash2 size={12} />
                  <span>{removeLabel}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-[11px] font-semibold text-ink">
            {session.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-ink">{session.name}</p>
            <p className="truncate text-[12px] text-subtle">{session.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mobile-toolbar-button flex h-9 w-9 items-center justify-center rounded-full text-subtle transition hover:text-ink"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface MobileModelPanelProps {
  modelGroups: ModelGroup[]
  activeModel: string
  activeModelMeta: ActiveModelMeta | null
  mobileText: MobileText
  modelMetaLabels: ReturnType<typeof getModelMetaLabels>
  selectedModelLabel: string
  onSelectModel: (modelId: string) => void
}

export const MobileModelPanel = ({
  modelGroups,
  activeModel,
  activeModelMeta,
  mobileText,
  modelMetaLabels,
  selectedModelLabel,
  onSelectModel,
}: MobileModelPanelProps) => {
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="mobile-glass-panel rounded-[24px] px-4 py-4">
        <p className="mobile-section-label">{mobileText.activeModel}</p>
        <p className="mt-2 text-[16px] font-semibold tracking-[-0.03em] text-ink">
          {activeModelMeta?.modelLabel ?? activeModel}
        </p>
        <p className="mt-1 text-[13px] text-subtle">{activeModelMeta?.providerLabel ?? ''}</p>
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <p className="mobile-section-label">{mobileText.availableModels}</p>
        <div className="mt-4 space-y-4">
          {modelGroups.map((group) => (
            <div key={group.providerId} className="space-y-2">
              <p className="text-[13px] font-semibold text-ink">{group.providerLabel}</p>
              <div className="space-y-2">
                {group.models.map((model) => {
                  const active = model.id === activeModel
                  const expanded = expandedModelId === model.id
                  return (
                    <div key={model.id} className="rounded-[20px] border border-black/6 bg-white/92 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedModelId((current) => (current === model.id ? null : model.id))
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-ink">{model.label}</p>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-subtle">
                            {model.description || (model.tags ?? []).join(' · ') || model.type || model.id}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className={clsx('shrink-0 text-subtle transition', expanded && 'rotate-90')}
                        />
                      </button>
                      {expanded ? (
                        <div className="space-y-3 border-t border-black/6 px-4 py-3">
                          <div className="space-y-1 text-[12px] leading-5 text-subtle">
                            {model.description ? <p>{model.description}</p> : null}
                            {model.type ? <p>{modelMetaLabels.type}: {model.type}</p> : null}
                            {model.contextWindow ? <p>{modelMetaLabels.context}: {model.contextWindow.toLocaleString()}</p> : null}
                            {(model.tags ?? []).length ? <p>{modelMetaLabels.tags}: {(model.tags ?? []).join(', ')}</p> : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectModel(model.id)
                            }}
                            className={clsx(
                              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition',
                              active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#111827] text-white',
                            )}
                          >
                            {active ? <Check size={14} /> : null}
                            <span>{active ? selectedModelLabel : mobileText.switchModel}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MobileToolsPanelProps {
  permissions: UserPermissionPolicy
  libraryItems: LibraryItem[]
  mobileText: MobileText
  mode: string
  onOpenInfo: () => void
  onOpenSettings: () => void
  onOpenVoice: () => void
}

export const MobileToolsPanel = ({
  permissions,
  libraryItems,
  mobileText,
  mode,
  onOpenInfo,
  onOpenSettings,
  onOpenVoice,
}: MobileToolsPanelProps) => {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onOpenInfo}
        className="mobile-soft-panel flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-subtle">
          <Info size={16} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-ink">{mobileText.workspace}</p>
          <p className="text-[12px] text-subtle">{mobileText.openWorkspace}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="mobile-soft-panel flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-subtle">
          <Settings size={16} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-ink">{mobileText.settings}</p>
          <p className="text-[12px] text-subtle">{mobileText.openSettings}</p>
        </div>
      </button>
      {permissions.allowVoiceMode ? (
        <button
          type="button"
          onClick={onOpenVoice}
          className="mobile-soft-panel flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-subtle">
            <Mic size={16} />
          </div>
          <div>
            <p className="text-[14px] font-medium text-ink">{mobileText.voice}</p>
            <p className="text-[12px] text-subtle">{mode}</p>
          </div>
        </button>
      ) : null}

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="mobile-section-label">{mobileText.library}</p>
          <span className="text-[12px] text-subtle">{libraryItems.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {libraryItems.length ? (
            libraryItems.slice(0, 4).map((item) => (
              <div key={item.id} className="mobile-muted-panel rounded-[18px] px-3 py-2.5">
                <p className="line-clamp-1 text-[13px] font-medium text-ink">{item.name}</p>
                <p className="mt-1 text-[11px] text-subtle">
                  {item.sizeLabel} · {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-subtle">{mobileText.noFiles}</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface MobileAccountPanelProps {
  session: AuthSession
  workspaceSummary: WorkspaceSummary | null
  permissions: UserPermissionPolicy
  modelGroups: ModelGroup[]
  layoutPreference: string
  mobileText: MobileText
  formatNumber: (n: number) => string
  onLayoutPreferenceChange: (pref: string) => void
  onLogout: () => void
  onOpenAdmin?: () => void
  onOpenSettings: () => void
  onSwitchToModels: () => void
}

export const MobileAccountPanel = ({
  session,
  workspaceSummary,
  permissions,
  modelGroups,
  layoutPreference,
  mobileText,
  formatNumber,
  onLayoutPreferenceChange,
  onLogout,
  onOpenAdmin,
  onOpenSettings,
  onSwitchToModels,
}: MobileAccountPanelProps) => {
  return (
    <div className="space-y-4">
      <div className="mobile-glass-panel rounded-[24px] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111827] text-[12px] font-semibold tracking-[0.16em] text-white">
            {session.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{session.name}</p>
            <p className="truncate text-[12px] text-subtle">{session.email}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-black/6 bg-white/80 px-3 py-1 text-[12px] font-medium text-ink">
            {session.role === 'admin' ? 'Administrator' : 'Workspace user'}
          </span>
          <span className="rounded-full border border-black/6 bg-white/80 px-3 py-1 text-[12px] text-subtle">
            {workspaceSummary?.allowedModelIds.length ?? modelGroups.reduce((sum, g) => sum + g.models.length, 0)} models
          </span>
        </div>
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <p className="mobile-section-label">Token &amp; Cost</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="mobile-muted-panel rounded-[18px] px-3 py-3">
            <p className="text-[11px] text-subtle">Input today</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {formatNumber(workspaceSummary?.usage.todayInputTokens ?? 0)}
            </p>
          </div>
          <div className="mobile-muted-panel rounded-[18px] px-3 py-3">
            <p className="text-[11px] text-subtle">Output today</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {formatNumber(workspaceSummary?.usage.todayOutputTokens ?? 0)}
            </p>
          </div>
          <div className="mobile-muted-panel rounded-[18px] px-3 py-3">
            <p className="text-[11px] text-subtle">Month total</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {formatNumber(workspaceSummary?.usage.monthTokens ?? 0)}
            </p>
          </div>
          <div className="mobile-muted-panel rounded-[18px] px-3 py-3">
            <p className="text-[11px] text-subtle">Est. cost</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              ${(workspaceSummary?.usage.monthlyEstimatedCost ?? 0).toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <p className="mobile-section-label">Permissions &amp; Entries</p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={onSwitchToModels}
            className="flex w-full items-center justify-between rounded-[18px] bg-white/82 px-3 py-3 text-left text-[13px] text-ink"
          >
            <span>Model access</span>
            <span className="text-subtle">{workspaceSummary?.allowedProviderIds.length ?? modelGroups.length} providers</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center justify-between rounded-[18px] bg-white/82 px-3 py-3 text-left text-[13px] text-ink"
          >
            <span>API key / Preferences</span>
            <ChevronRight size={15} className="text-subtle" />
          </button>
          {session.role === 'admin' && onOpenAdmin ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex w-full items-center justify-between rounded-[18px] bg-[#111827] px-3 py-3 text-left text-[13px] font-medium text-white"
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={15} />
                Admin console
              </span>
              <ChevronRight size={15} className="text-white/70" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <div className="flex items-center gap-2 mobile-section-label">
          <Layers3 size={14} />
          <span>{mobileText.interfaceMode}</span>
        </div>
        <LayoutModeSwitcher
          value={layoutPreference}
          onChange={onLayoutPreferenceChange}
          className="mt-3"
        />
      </div>

      <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
        <div className="flex items-center gap-2 mobile-section-label">
          <Languages size={14} />
          <span>{mobileText.pickLanguage}</span>
        </div>
        <div className="mt-3">
          <LanguageSwitcher className="justify-start" />
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-red-200 bg-red-50/88 px-4 py-3 text-[14px] font-medium text-[rgb(var(--danger))]"
      >
        <LogOut size={16} />
        <span>{mobileText.logout}</span>
      </button>
    </div>
  )
}
