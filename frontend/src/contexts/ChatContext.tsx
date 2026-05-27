import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useChat } from '../hooks/useChat'
import { useWorkspace } from '../hooks/useWorkspace'
import { buildMarketContext, buildMarketOverview } from '../utils/chat'
import type { Locale } from '../i18n/messages'
import type { AuthSession } from '../types/auth'
import type { ChatAttachment, ChatMessage, Conversation, ProviderCatalog, UserPermissionPolicy, WorkspaceSummary } from '../types/chat'
import type { LibraryItem } from '../types/library'
import type { MarketContext } from '../types'

// ── Types ──

export interface MarketContextState {
  type: 'stock' | 'market' | 'none'
  label: string
  data: MarketContext | null
}

export interface ChatContextValue {
  // Session
  isLoggedIn: boolean

  // Conversations
  conversations: Conversation[]
  currentConversation: Conversation | null
  currentConversationId: string
  isSending: boolean
  error: string | null

  // Actions
  createConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  sendMessage: (payload: { content: string; model?: string; mode?: string; attachments?: ChatAttachment[] }) => Promise<void>
  editMessage: (payload: { messageId: string; content: string; model?: string; mode?: string }) => Promise<void>
  stopStreaming: () => void

  // Model
  modelGroups: Array<{ providerId: string; providerLabel: string; models: Array<{ id: string; label: string; description: string | null; type: string | null; contextWindow: number | null; tags: string[]; inputPricePer1k: number | null; outputPricePer1k: number | null }> }>
  modelOptions: Array<{ id: string; label: string }>
  activeModel: string | undefined
  activeProviderId: string | undefined
  handleSelectModel: (modelId: string) => void

  // Workspace
  catalog: ProviderCatalog | null
  workspaceSummary: WorkspaceSummary | null
  permissions: UserPermissionPolicy
  libraryItems: LibraryItem[]
  refreshWorkspace: () => void
  handleUploadFiles: (files: File[]) => Promise<LibraryItem[]>

  // Market context
  marketContext: MarketContextState
  setMarketContext: (ctx: MarketContextState) => void
  setMarketOverviewData: (data: { indices: Array<{ code: string; name: string; latest_price: number; change_pct: number }>; breadth: { up: number; down: number; flat: number; total: number }; turnover?: { sh_total: number; sz_total: number; total: number } | null; northbound?: { sh_net: number; sz_net: number; total_net: number; date: string } | null }) => void

  // Floating overlay
  isOverlayOpen: boolean
  setOverlayOpen: (open: boolean) => void

  // Draft
  draft: string
  setDraft: (value: string) => void
  editingMessage: ChatMessage | null
  setEditingMessage: (msg: ChatMessage | null) => void
}

const defaultPermissions: UserPermissionPolicy = {
  allowLibraryUpload: true,
  allowVoiceMode: true,
  allowWebSearch: true,
  allowDeepResearch: true,
  allowImageTools: true,
  allowAgentMode: true,
}

const noop = () => {}
const asyncNoop = async () => {}

const EMPTY_CONTEXT: ChatContextValue = {
  isLoggedIn: false,
  conversations: [],
  currentConversation: null,
  currentConversationId: '',
  isSending: false,
  error: null,
  createConversation: noop,
  selectConversation: noop,
  deleteConversation: noop,
  renameConversation: noop,
  sendMessage: asyncNoop,
  editMessage: asyncNoop,
  stopStreaming: noop,
  modelGroups: [],
  modelOptions: [],
  activeModel: undefined,
  activeProviderId: undefined,
  handleSelectModel: noop,
  catalog: null,
  workspaceSummary: null,
  permissions: defaultPermissions,
  libraryItems: [],
  refreshWorkspace: noop,
  handleUploadFiles: async () => [],
  marketContext: { type: 'none', label: '', data: null },
  setMarketContext: noop,
  setMarketOverviewData: noop,
  isOverlayOpen: false,
  setOverlayOpen: noop,
  draft: '',
  setDraft: noop,
  editingMessage: null,
  setEditingMessage: noop,
}

const ChatContext = createContext<ChatContextValue>(EMPTY_CONTEXT)

export function useChatContext(): ChatContextValue {
  return useContext(ChatContext)
}

// ── Provider ──

export function ChatProvider({ session, children }: { session: AuthSession | null; children: ReactNode }) {
  if (!session) {
    return (
      <ChatContext.Provider value={EMPTY_CONTEXT}>
        {children}
      </ChatContext.Provider>
    )
  }
  return <ChatProviderInner session={session}>{children}</ChatProviderInner>
}

function ChatProviderInner({ session, children }: { session: AuthSession; children: ReactNode }) {
  const chat = useChat({ session })
  const workspace = useWorkspace({ setConversationDefaults: chat.setConversationDefaults })

  const [marketContext, setMarketContext] = useState<MarketContextState>({ type: 'none', label: '', data: null })
  const [isOverlayOpen, setOverlayOpen] = useState(false)
  const marketOverviewRef = useRef<{ indices: Array<{ code: string; name: string; latest_price: number; change_pct: number }>; breadth: { up: number; down: number; flat: number; total: number }; turnover?: { sh_total: number; sz_total: number; total: number } | null; northbound?: { sh_net: number; sz_net: number; total_net: number; date: string } | null } | null>(null)
  const [draft, setDraft] = useState('')
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)

  const conversations = chat.conversations
  const currentConversationId = chat.currentConversationId
  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) ?? null,
    [conversations, currentConversationId],
  )
  const selectedModelId = currentConversation?.selectedModelId
  const selectedProviderId = currentConversation?.selectedProviderId
  const autoModelStrategy = currentConversation?.autoModelStrategy

  const catalog = workspace.catalog
  const catalogProviders = catalog?.providers

  const modelGroups = useMemo(
    () =>
      catalogProviders
        ?.map((provider) => ({
          providerId: provider.id,
          providerLabel: provider.label,
          models: provider.models
            .filter((item) => item.available)
            .map((item) => ({
              id: item.id,
              label: item.label,
              description: item.description ?? null,
              type: item.type ?? null,
              contextWindow: item.contextWindow ?? null,
              tags: item.tags ?? [],
              inputPricePer1k: item.inputPricePer1k ?? null,
              outputPricePer1k: item.outputPricePer1k ?? null,
            })),
        }))
        .filter((group) => group.models.length > 0) ?? [],
    [catalogProviders],
  )

  const modelOptions = useMemo(
    () =>
      catalogProviders?.flatMap((provider) =>
        provider.models
          .filter((item) => item.available)
          .map((item) => ({ id: item.id, label: item.label })),
      ) ?? [],
    [catalogProviders],
  )

  const activeModel = useMemo(() => {
    if (!catalog) return selectedModelId ?? undefined
    const allowedModelIds = new Set(modelOptions.map((item) => item.id))
    return (selectedModelId && allowedModelIds.has(selectedModelId))
      ? selectedModelId
      : catalog.managedDefaultModel
  }, [catalog, selectedModelId, modelOptions])

  const activeProviderId = useMemo(
    () =>
      selectedProviderId ??
      modelGroups.find((group) => group.models.some((item) => item.id === activeModel))?.providerId ??
      catalog?.managedProviderId,
    [activeModel, catalog?.managedProviderId, selectedProviderId, modelGroups],
  )

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (!currentConversation) return
      const nextMeta = modelGroups
        .flatMap((group) =>
          group.models.map((item) => ({
            providerId: group.providerId,
            modelId: item.id,
          })),
        )
        .find((item) => item.modelId === modelId)
      void chat.updateConversationModel({
        conversationId: currentConversation.id,
        modelId,
        providerId: nextMeta?.providerId ?? null,
        autoModelStrategy: autoModelStrategy ?? workspace.workspaceSummary?.modeOptions[0]?.strategy ?? null,
      })
    },
    [chat, modelGroups, workspace.workspaceSummary, currentConversation, autoModelStrategy],
  )

  const prevMarketContextRef = useRef<MarketContextState>(marketContext)
  prevMarketContextRef.current = marketContext

  const getLocale = (): Locale => {
    try {
      const raw = localStorage.getItem('aurora-locale')
      if (raw === 'zh-CN' || raw === 'en-US' || raw === 'ja-JP' || raw === 'es-ES') return raw
    } catch { /* localStorage unavailable */ }
    return 'zh-CN'
  }

  const sendMessageWithContext = useCallback(
    async (payload: { content: string; model?: string; mode?: string; attachments?: ChatAttachment[] }) => {
      const locale = getLocale()
      let marketContextStr: string | null = null
      const ctx = prevMarketContextRef.current
      if (ctx.type === 'stock' && ctx.data) {
        marketContextStr = buildMarketContext(ctx.data, locale)
      } else {
        const overview = marketOverviewRef.current
        if (overview && overview.indices.length > 0) {
          marketContextStr = buildMarketOverview(overview.indices, overview.breadth, overview.turnover ?? null, overview.northbound ?? null, locale)
        }
      }
      await chat.sendMessage({
        content: payload.content,
        model: payload.model ?? activeModel,
        mode: payload.mode,
        attachments: payload.attachments ?? [],
        marketContext: marketContextStr,
      })
    },
    [chat, activeModel],
  )

  const setMarketOverviewData = useCallback(
    (data: { indices: Array<{ code: string; name: string; latest_price: number; change_pct: number }>; breadth: { up: number; down: number; flat: number; total: number }; turnover?: { sh_total: number; sz_total: number; total: number } | null; northbound?: { sh_net: number; sz_net: number; total_net: number; date: string } | null }) => {
      marketOverviewRef.current = data
    },
    [],
  )

  const value: ChatContextValue = useMemo(() => ({
    isLoggedIn: true,
    conversations,
    currentConversation,
    currentConversationId,
    isSending: chat.isSending,
    error: chat.error,
    createConversation: chat.createConversation,
    selectConversation: chat.selectConversation,
    deleteConversation: chat.deleteConversation,
    renameConversation: chat.renameConversation,
    sendMessage: sendMessageWithContext,
    editMessage: chat.editMessage,
    stopStreaming: chat.stopStreaming,
    modelGroups,
    modelOptions,
    activeModel,
    activeProviderId,
    handleSelectModel,
    catalog,
    workspaceSummary: workspace.workspaceSummary,
    permissions: workspace.permissions,
    libraryItems: workspace.libraryItems,
    refreshWorkspace: workspace.refreshWorkspace,
    handleUploadFiles: workspace.handleUploadFiles,
    marketContext,
    setMarketContext,
    setMarketOverviewData,
    isOverlayOpen,
    setOverlayOpen,
    draft,
    setDraft,
    editingMessage,
    setEditingMessage,
  }), [
    conversations, currentConversation, currentConversationId,
    chat.isSending, chat.error, chat.createConversation, chat.selectConversation,
    chat.deleteConversation, chat.renameConversation, chat.editMessage, chat.stopStreaming,
    sendMessageWithContext,
    modelGroups, modelOptions, activeModel, activeProviderId, handleSelectModel,
    catalog, workspace.workspaceSummary, workspace.permissions, workspace.libraryItems,
    workspace.refreshWorkspace, workspace.handleUploadFiles,
    marketContext, setMarketOverviewData, isOverlayOpen, draft, editingMessage,
  ])

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}
