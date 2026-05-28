import { useCallback, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { ChatHeader } from '../../components/chat/ChatHeader'
import { ChatInfoDrawer } from '../../components/chat/ChatInfoDrawer'
import { ChatWindow } from '../../components/chat/ChatWindow'
import { Composer } from '../../components/chat/Composer'
import { EmptyState } from '../../components/chat/EmptyState'
import { SettingsModal } from '../../components/chat/SettingsModal'
import { VoiceOverlay } from '../../components/chat/VoiceOverlay'
import { ConversationSidebar } from '../../components/sidebar/ConversationSidebar'
import { login } from '../../services/auth'
import { useChat } from '../../hooks/useChat'
import { useWorkspace } from '../../hooks/useWorkspace'
import { buildMarketContext, buildMarketOverview } from '../../utils/chat'
import type { AuthSession } from '../../types/auth'
import type { ChatAttachment, ChatMessage } from '../../types/chat'
import type { MarketContext } from '../../types'
import type { Locale } from '../../i18n/messages'

function getLocale(): Locale {
  try {
    const raw = localStorage.getItem('aurora-locale')
    if (raw === 'zh-CN' || raw === 'en-US' || raw === 'ja-JP' || raw === 'es-ES') return raw
  } catch { /* localStorage unavailable */ }
  return 'zh-CN'
}

interface Props {
  session: AuthSession | null
  authLoading: boolean
  stockContext: MarketContext | null
  onStockContextHandled: () => void
  onLogout: () => void
  onOpenAdmin?: () => void
  indices?: Array<{ code: string; name: string; latest_price: number; change_pct: number }>
  breadth?: { up: number; down: number; flat: number; total: number }
}

export default function ChatPanel({ session, authLoading, stockContext, onStockContextHandled, onLogout, onOpenAdmin, indices, breadth }: Props) {
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-xs">加载中...</span>
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <AuthenticatedChat
      session={session}
      stockContext={stockContext}
      onStockContextHandled={onStockContextHandled}
      onLogout={onLogout}
      onOpenAdmin={onOpenAdmin}
      indices={indices}
      breadth={breadth}
    />
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setError(null)
    setLoading(true)
    try {
      await login({ email: email.trim(), password })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }, [email, password])

  return (
    <div className="chat-panel flex items-center justify-center h-full px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">登录 AI 交易助手</h3>
          <p className="text-xs text-[rgb(var(--muted))] mt-1">登录后可使用 AI 辅助交易分析</p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          autoComplete="email"
          className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--subtle))] focus:outline-none focus:border-[rgb(var(--accent))]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          autoComplete="current-password"
          className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--subtle))] focus:outline-none focus:border-[rgb(var(--accent))]"
        />

        <button
          type="submit"
          disabled={loading || !email.trim() || !password.trim()}
          className="w-full py-2 bg-[rgb(var(--accent))] text-white text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <p className="text-[10px] text-[rgb(var(--muted))] text-center">
          没有账号？请联系管理员创建
        </p>
      </form>
    </div>
  )
}

function AuthenticatedChat({
  session,
  stockContext,
  onStockContextHandled,
  onLogout,
  onOpenAdmin,
  indices,
  breadth,
}: {
  session: AuthSession
  stockContext: MarketContext | null
  onStockContextHandled: () => void
  onLogout: () => void
  onOpenAdmin?: () => void
  indices?: Array<{ code: string; name: string; latest_price: number; change_pct: number }>
  breadth?: { up: number; down: number; flat: number; total: number }
}) {
  const {
    conversations,
    currentConversation,
    currentConversationId,
    isSending,
    error,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    setConversationDefaults,
    updateConversationModel,
    sendMessage,
    editMessage,
    stopStreaming,
  } = useChat({ session })

  const { libraryItems, catalog, workspaceSummary, permissions, refreshWorkspace, handleUploadFiles } =
    useWorkspace({ setConversationDefaults })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)

  const hasMessages = Boolean(currentConversation && currentConversation.messages.filter((m) => m.role !== 'system').length > 0)

  const modelGroups = useMemo(
    () =>
      catalog?.providers
        .map((provider) => ({
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
    [catalog],
  )

  const modelOptions = useMemo(
    () =>
      catalog?.providers.flatMap((provider) =>
        provider.models
          .filter((item) => item.available)
          .map((item) => ({ id: item.id, label: item.label })),
      ) ?? [],
    [catalog],
  )

  const activeModel = useMemo(() => {
    const selectedModel = currentConversation?.selectedModelId
    if (!catalog) return selectedModel
    const allowedModelIds = new Set(modelOptions.map((item) => item.id))
    return selectedModel && allowedModelIds.has(selectedModel)
      ? selectedModel
      : catalog.managedDefaultModel
  }, [catalog, currentConversation?.selectedModelId, modelOptions])

  const activeProviderId = useMemo(
    () =>
      currentConversation?.selectedProviderId ??
      modelGroups.find((group) => group.models.some((item) => item.id === activeModel))?.providerId ??
      catalog?.managedProviderId,
    [activeModel, catalog?.managedProviderId, currentConversation?.selectedProviderId, modelGroups],
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
      void updateConversationModel({
        conversationId: currentConversation.id,
        modelId,
        providerId: nextMeta?.providerId ?? null,
        autoModelStrategy: currentConversation.autoModelStrategy ?? workspaceSummary?.modeOptions[0]?.strategy ?? null,
      })
    },
    [currentConversation, modelGroups, updateConversationModel, workspaceSummary],
  )

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setDraft(message.content)
    setEditingMessage(message)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
    setDraft('')
  }, [])

  const handleSend = useCallback(
    async ({ content, attachments }: { content: string; attachments: ChatAttachment[] }) => {
      const trimmed = content.trim()
      if (!trimmed || isSending) return

      const locale = getLocale()
      let marketContext: string | null = null
      if (stockContext) {
        marketContext = buildMarketContext(stockContext, locale)
      } else if (indices && indices.length > 0 && breadth && breadth.total > 0) {
        marketContext = buildMarketOverview(indices, breadth, null, null, locale)
      }
      const mode = workspaceSummary?.modeOptions[0]?.strategy

      if (editingMessage) {
        await editMessage({ messageId: editingMessage.id, content: trimmed, model: activeModel, mode, marketContext })
        setEditingMessage(null)
      } else {
        await sendMessage({ content: trimmed, model: activeModel, mode, attachments, marketContext })
      }
      setDraft('')

      if (stockContext) {
        onStockContextHandled()
      }
    },
    [isSending, stockContext, editingMessage, editMessage, sendMessage, activeModel, workspaceSummary, onStockContextHandled, indices, breadth],
  )

  return (
    <div className="chat-panel flex h-full overflow-hidden">
      <ConversationSidebar
        session={session}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onCreateConversation={createConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onLogout={onLogout}
        onOpenAdmin={onOpenAdmin}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          conversation={currentConversation}
          allowVoiceMode={permissions.allowVoiceMode}
          allowModelSwitch={catalog?.allowUserModelSwitch ?? false}
          modelGroups={modelGroups}
          currentProviderId={activeProviderId}
          currentModel={activeModel}
          onCreateConversation={createConversation}
          onModelChange={handleSelectModel}
          onOpenInfo={() => setInfoOpen(true)}
          onToggleVoice={() => setVoiceOpen(true)}
          usageSummary={workspaceSummary?.usage}
        />

        {error && (
          <div className="shrink-0 border-b border-red-800/40 bg-red-950/20 px-4 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {hasMessages ? (
          <>
            <div className="min-h-0 flex-1">
              <ChatWindow
                conversation={currentConversation}
                isSending={isSending}
                onEditMessage={handleEditMessage}
              />
            </div>
            <Composer
              disabled={isSending}
              canStop={isSending}
              permissions={permissions}
              libraryItems={libraryItems}
              value={draft}
              onValueChange={setDraft}
              editingLabel={editingMessage?.content ?? null}
              onCancelEdit={handleCancelEdit}
              onStop={stopStreaming}
              onUploadFiles={handleUploadFiles}
              onSend={handleSend}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-10">
            <div className="w-full max-w-[640px]">
              <EmptyState onPromptClick={(text) => setDraft(text)} />
              <div className="mt-6">
                <Composer
                  centered
                  showCapabilities
                  disabled={isSending}
                  canStop={isSending}
                  permissions={permissions}
                  libraryItems={libraryItems}
                  value={draft}
                  onValueChange={setDraft}
                  editingLabel={editingMessage?.content ?? null}
                  onCancelEdit={handleCancelEdit}
                  onStop={stopStreaming}
                  onUploadFiles={handleUploadFiles}
                  onSend={handleSend}
                />
              </div>
            </div>
          </div>
        )}

        <SettingsModal
          open={settingsOpen}
          section="general"
          onClose={() => setSettingsOpen(false)}
        />

        <ChatInfoDrawer
          open={infoOpen}
          catalog={catalog}
          libraryItems={libraryItems}
          workspaceSummary={workspaceSummary}
          onClose={() => setInfoOpen(false)}
          onOpenSettings={() => {
            setInfoOpen(false)
            setSettingsOpen(true)
          }}
        />

        <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      </section>
    </div>
  )
}
