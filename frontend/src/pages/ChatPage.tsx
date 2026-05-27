import clsx from 'clsx'
import {
  Bot,
  FolderOpen,
  Info,
  MessageSquare,
  MessageSquarePlus,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ChatHeader } from '../components/chat/ChatHeader'
import { ChatInfoDrawer } from '../components/chat/ChatInfoDrawer'
import { ChatWindow } from '../components/chat/ChatWindow'
import { Composer } from '../components/chat/Composer'
import { EmptyState } from '../components/chat/EmptyState'
import {
  getMobileText,
  getModelMetaLabels,
  getSelectedModelLabel,
  MobileAccountPanel,
  MobileConversationList,
  MobileModelPanel,
  MobileToolsPanel,
} from '../components/chat/MobilePanels'
import type { MobilePanel } from '../components/chat/MobilePanels'
import { SettingsModal } from '../components/chat/SettingsModal'
import { VoiceOverlay } from '../components/chat/VoiceOverlay'
import { MobileSheet } from '../components/common/MobileSheet'
import { ConversationSidebar } from '../components/sidebar/ConversationSidebar'
import { useChat } from '../hooks/useChat'
import { useI18n } from '../i18n/I18nProvider'
import { useLayoutMode } from '../hooks/useLayoutMode'
import { useWorkspace } from '../hooks/useWorkspace'
import type { AuthSession } from '../types/auth'
import type { ChatMessage } from '../types/chat'

interface ChatPageProps {
  session: AuthSession
  onLogout: () => void
  onOpenAdmin?: () => void
}

export const ChatPage = ({ session, onLogout, onOpenAdmin }: ChatPageProps) => {
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

  const { locale, formatNumber, t } = useI18n()
  const { preference: layoutPreference, resolvedMode, setPreference: setLayoutPreference } = useLayoutMode('user')
  const {
    libraryItems,
    catalog,
    workspaceSummary,
    permissions,
    refreshWorkspace,
    handleUploadFiles,
  } = useWorkspace({ setConversationDefaults })

  const [voiceOpen, setVoiceOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [clientNotice, setClientNotice] = useState<string | null>(null)

  useEffect(() => {
    setMobilePanel(null)
  }, [resolvedMode, currentConversationId])

  const hasMessages = Boolean(currentConversation && currentConversation.messages.length > 0)
  const mode = workspaceSummary?.modeOptions[0]?.label ?? 'Instant'
  const mobileText = useMemo(() => getMobileText(locale), [locale])
  const modelMetaLabels = useMemo(() => getModelMetaLabels(locale), [locale])
  const selectedModelLabel = useMemo(() => getSelectedModelLabel(locale), [locale])

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
    if (!catalog) return selectedModel ?? 'qwen3-vl-plus'
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

  const activeModelMeta = useMemo(
    () =>
      modelGroups
        .flatMap((group) =>
          group.models.map((item) => ({
            providerId: group.providerId,
            providerLabel: group.providerLabel,
            modelId: item.id,
            modelLabel: item.label,
            description: item.description,
          })),
        )
        .find((item) => item.modelId === activeModel) ?? null,
    [activeModel, modelGroups],
  )

  useEffect(() => {
    if (!catalog || !currentConversation?.selectedModelId) return
    const allowedIds = new Set(modelOptions.map((item) => item.id))
    if (allowedIds.has(currentConversation.selectedModelId)) return
    const fallbackModel = catalog.managedDefaultModel || modelOptions[0]?.id
    if (!fallbackModel) return
    const fallbackProvider =
      modelGroups.find((group) => group.models.some((item) => item.id === fallbackModel))?.providerId ??
      catalog.managedProviderId
    void updateConversationModel({
      conversationId: currentConversation.id,
      modelId: fallbackModel,
      providerId: fallbackProvider,
      autoModelStrategy: currentConversation.autoModelStrategy ?? null,
    })
  }, [catalog, currentConversation, modelGroups, modelOptions, updateConversationModel])

  const buildSwitchTrace = useCallback(
    (providerLabel: string, modelLabel: string) => {
      const providerPart = providerLabel ? `${providerLabel} / ` : ''
      switch (locale) {
        case 'en-US':
          return `Switched to ${providerPart}${modelLabel}. The next reply will continue with the current conversation.`
        case 'ja-JP':
          return `${providerPart}${modelLabel} に切り替えました。次の返信では現在の会話を引き継ぎます。`
        case 'es-ES':
          return `Se cambio a ${providerPart}${modelLabel}. La siguiente respuesta continuara con la conversacion actual.`
        default:
          return `已切换至 ${providerPart}${modelLabel}。下一轮回复会继续当前会话。`
      }
    },
    [locale],
  )

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (!currentConversation) return
      const nextMeta =
        modelGroups
          .flatMap((group) =>
            group.models.map((item) => ({
              providerId: group.providerId,
              providerLabel: group.providerLabel,
              modelId: item.id,
              modelLabel: item.label,
            })),
          )
          .find((item) => item.modelId === modelId) ?? activeModelMeta

      void updateConversationModel({
        conversationId: currentConversation.id,
        modelId,
        providerId: nextMeta?.providerId ?? null,
        autoModelStrategy:
          currentConversation.autoModelStrategy ??
          workspaceSummary?.modeOptions[0]?.strategy ??
          null,
        traceContent:
          nextMeta && modelId !== currentConversation.selectedModelId
            ? buildSwitchTrace(nextMeta.providerLabel, nextMeta.modelLabel)
            : null,
      })
      setMobilePanel(null)
    },
    [activeModelMeta, buildSwitchTrace, currentConversation, modelGroups, updateConversationModel, workspaceSummary],
  )

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setDraft(message.content)
    setEditingMessage(message)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
    setDraft('')
  }, [])

  const handleSend = useCallback(
    async ({
      content,
      attachments,
    }: {
      content: string
      attachments: Array<{ id: string; name: string; type: string; source: string }>
    }) => {
      setClientNotice(null)
      const refreshed = await refreshWorkspace()
      const allowedIds = new Set(
        refreshed?.catalog.providers.flatMap((provider) =>
          provider.models.filter((item) => item.available).map((item) => item.id),
        ) ?? modelOptions.map((item) => item.id),
      )
      const sendModel =
        currentConversation?.selectedModelId && allowedIds.has(currentConversation.selectedModelId)
          ? currentConversation.selectedModelId
          : refreshed?.catalog.managedDefaultModel ?? activeModel
      const hasImageAttachment = attachments.some((attachment) =>
        attachment.type.toLowerCase().startsWith('image'),
      )
      if (hasImageAttachment) {
        const nextCatalog = refreshed?.catalog ?? catalog
        const sendModelMeta = nextCatalog?.providers
          .flatMap((provider) => provider.models)
          .find((model) => model.id === sendModel)
        const supportsVision =
          sendModelMeta?.type?.toLowerCase() === 'vision' ||
          sendModelMeta?.tags.some((tag) => tag.toLowerCase().includes('vision')) ||
          sendModelMeta?.tags.some((tag) => tag.toLowerCase().includes('image'))
        if (!supportsVision) {
          setClientNotice('当前模型不支持图片附件，请切换到 vision / 图像模型后再发送。')
          return
        }
      }

      if (editingMessage) {
        await editMessage({ messageId: editingMessage.id, content, model: sendModel, mode })
        setEditingMessage(null)
        setDraft('')
        return
      }

      await sendMessage({ content, model: sendModel, mode, attachments })
      setDraft('')
    },
    [activeModel, catalog, currentConversation, editMessage, editingMessage, mode, modelOptions, refreshWorkspace, sendMessage],
  )

  const usageAccent = workspaceSummary ? (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      <span className="rounded-full border border-black/6 bg-white/92 px-3.5 py-1.5 text-[12px] text-subtle shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
        今日 {workspaceSummary.usage.todayTokens.toLocaleString()} Token
      </span>
      <span className="rounded-full border border-black/6 bg-white/92 px-3.5 py-1.5 text-[12px] text-subtle shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
        本月 {workspaceSummary.usage.monthTokens.toLocaleString()} Token
      </span>
      <span className="rounded-full border border-[rgba(48,95,184,0.12)] bg-[rgba(248,250,255,0.92)] px-3.5 py-1.5 text-[12px] text-[rgba(76,98,148,0.88)] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
        剩余额度 {workspaceSummary.usage.remainingMonthlyTokens.toLocaleString()}
      </span>
    </div>
  ) : null

  const desktopShell = (
    <div className="aurora-workspace relative flex h-screen min-w-[1024px] overflow-hidden">
      <div className="hidden h-screen shrink-0 lg:block aurora-enter-sidebar">
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
      </div>

      <section className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden max-lg:pb-[calc(env(safe-area-inset-bottom)+82px)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_-8%,rgba(132,154,214,0.16),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(190,203,235,0.16),transparent_30%),radial-gradient(circle_at_52%_112%,rgba(255,255,255,0.72),transparent_42%)]" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(247,248,251,0.58)_42%,rgba(244,246,250,0.74))]" />

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

        {error ? (
          <div className="relative z-10 border-b border-red-200/70 bg-red-50/80 px-6 py-3 text-sm text-[rgb(var(--danger))] sm:px-10">
            <div className="mx-auto max-w-[1120px]">{error}</div>
          </div>
        ) : null}
        {clientNotice ? (
          <div className="relative z-10 border-b border-amber-200/70 bg-amber-50/85 px-6 py-3 text-sm text-amber-800 sm:px-10">
            <div className="mx-auto max-w-[1120px]">{clientNotice}</div>
          </div>
        ) : null}

        {hasMessages ? (
          <>
            <div className="aurora-enter-content relative z-10 min-h-0 flex-1">
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
          <div className="aurora-enter-content relative z-10 flex flex-1 items-center justify-center px-6 py-14 sm:px-10">
            <div className="w-full max-w-[980px] animate-fade-up">
              <EmptyState />
              {usageAccent}
              <div className="mt-9">
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
      </section>

      <nav className="mobile-bottom-dock fixed inset-x-0 bottom-0 z-30 px-3 py-2 lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'conversations' as const, label: mobileText.conversations, icon: MessageSquare },
            { key: 'models' as const, label: mobileText.models, icon: Bot },
            { key: 'tools' as const, label: mobileText.tools, icon: FolderOpen },
            { key: 'account' as const, label: mobileText.account, icon: UserRound },
          ].map((item) => {
            const Icon = item.icon
            const active = mobilePanel === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'models') void refreshWorkspace()
                  setMobilePanel((current) => (current === item.key ? null : item.key))
                }}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-[18px] px-2 py-2.5 text-[11px] font-medium transition',
                  active
                    ? 'bg-[#171c27] text-white shadow-[0_12px_22px_rgba(15,23,42,0.14)]'
                    : 'text-subtle hover:bg-white/70 hover:text-ink',
                )}
              >
                <Icon size={16} />
                <span className="mt-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <MobileSheet
        open={mobilePanel === 'conversations'}
        title={mobileText.conversations}
        onClose={() => setMobilePanel(null)}
        fullHeight
      >
        <MobileConversationList
          session={session}
          conversations={conversations}
          currentConversationId={currentConversationId}
          createLabel={t('chat.newChat')}
          onCreateConversation={() => {
            createConversation()
            setMobilePanel(null)
          }}
          onSelectConversation={(conversationId) => {
            selectConversation(conversationId)
            setMobilePanel(null)
          }}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onLogout={onLogout}
          renameLabel={mobileText.rename}
          removeLabel={mobileText.remove}
        />
      </MobileSheet>

      <MobileSheet
        open={mobilePanel === 'models'}
        title={mobileText.switchModel}
        onClose={() => setMobilePanel(null)}
        fullHeight
      >
        <MobileModelPanel
          modelGroups={modelGroups}
          activeModel={activeModel}
          activeModelMeta={activeModelMeta}
          mobileText={mobileText}
          modelMetaLabels={modelMetaLabels}
          selectedModelLabel={selectedModelLabel}
          onSelectModel={handleSelectModel}
        />
      </MobileSheet>

      <MobileSheet open={mobilePanel === 'tools'} title={mobileText.tools} onClose={() => setMobilePanel(null)}>
        <MobileToolsPanel
          permissions={permissions}
          libraryItems={libraryItems}
          mobileText={mobileText}
          mode={mode}
          onOpenInfo={() => {
            setMobilePanel(null)
            setInfoOpen(true)
          }}
          onOpenSettings={() => {
            setMobilePanel(null)
            setSettingsOpen(true)
          }}
          onOpenVoice={() => {
            setMobilePanel(null)
            setVoiceOpen(true)
          }}
        />
      </MobileSheet>

      <MobileSheet open={mobilePanel === 'account'} title={mobileText.account} onClose={() => setMobilePanel(null)}>
        <MobileAccountPanel
          session={session}
          workspaceSummary={workspaceSummary}
          permissions={permissions}
          modelGroups={modelGroups}
          layoutPreference={layoutPreference}
          mobileText={mobileText}
          formatNumber={formatNumber}
          onLayoutPreferenceChange={setLayoutPreference}
          onLogout={onLogout}
          onOpenAdmin={onOpenAdmin}
          onOpenSettings={() => {
            setMobilePanel(null)
            setSettingsOpen(true)
          }}
          onSwitchToModels={() => setMobilePanel('models')}
        />
      </MobileSheet>
    </div>
  )

  const mobileShell = (
    <div className="mobile-shell-bg relative flex h-[100dvh] min-h-[100svh] flex-col overflow-hidden">
      <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/90 px-4 pb-3 pt-3 backdrop-blur-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold tracking-tight text-[rgb(var(--text))]">
              {currentConversation?.title ?? 'Aurora'}
            </p>
            <button
              type="button"
              onClick={() => setUsageOpen((current) => !current)}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-[11px] text-[rgb(var(--muted))] transition active:scale-[0.98]"
            >
              <span className="font-medium">{modelMetaLabels.today}</span>
              <span>{workspaceSummary ? formatNumber(workspaceSummary.usage.todayTokens) : '0'} Token</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => createConversation()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--muted))] transition hover:bg-black/5 hover:text-[rgb(var(--text))]"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--muted))] transition hover:bg-black/5 hover:text-[rgb(var(--text))]"
            >
              <Info size={16} />
            </button>
          </div>
        </div>

        {usageOpen && workspaceSummary ? (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-[20px] border border-black/6 bg-white/82 p-3 text-[12px] text-subtle shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <span>输入 {formatNumber(workspaceSummary.usage.todayInputTokens)}</span>
            <span>输出 {formatNumber(workspaceSummary.usage.todayOutputTokens)}</span>
            <span>总量 {formatNumber(workspaceSummary.usage.todayTokens)}</span>
            <span>费用 ${workspaceSummary.usage.todayEstimatedCost.toFixed(4)}</span>
          </div>
        ) : null}
      </header>

      {error || clientNotice ? (
        <div className="border-b border-red-200/70 bg-red-50/80 px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {error ?? clientNotice}
        </div>
      ) : null}

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {hasMessages ? (
          <>
            <div className="relative min-h-0 flex-1">
              <ChatWindow
                conversation={currentConversation}
                isSending={isSending}
                onEditMessage={handleEditMessage}
              />
            </div>
            <div className="pb-[calc(env(safe-area-inset-bottom)+86px)]">
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
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+94px)] pt-6">
            <div>
              <EmptyState />
              {usageAccent}
            </div>
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
        )}
      </section>

      <nav className="mobile-bottom-dock fixed inset-x-0 bottom-0 z-30 px-3 py-2 lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'conversations' as const, label: mobileText.conversations, icon: MessageSquare },
            { key: 'models' as const, label: mobileText.models, icon: Bot },
            { key: 'tools' as const, label: mobileText.tools, icon: FolderOpen },
            { key: 'account' as const, label: mobileText.account, icon: UserRound },
          ].map((item) => {
            const Icon = item.icon
            const active = mobilePanel === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'models') void refreshWorkspace()
                  setMobilePanel((current) => (current === item.key ? null : item.key))
                }}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-[18px] px-2 py-2.5 text-[11px] font-medium transition',
                  active
                    ? 'bg-[#171c27] text-white shadow-[0_12px_22px_rgba(15,23,42,0.14)]'
                    : 'text-subtle hover:bg-white/70 hover:text-ink',
                )}
              >
                <Icon size={16} />
                <span className="mt-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <MobileSheet
        open={mobilePanel === 'conversations'}
        title={mobileText.conversations}
        onClose={() => setMobilePanel(null)}
        fullHeight
      >
        <MobileConversationList
          session={session}
          conversations={conversations}
          currentConversationId={currentConversationId}
          createLabel={t('chat.newChat')}
          onCreateConversation={() => {
            createConversation()
            setMobilePanel(null)
          }}
          onSelectConversation={(conversationId) => {
            selectConversation(conversationId)
            setMobilePanel(null)
          }}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onLogout={onLogout}
          renameLabel={mobileText.rename}
          removeLabel={mobileText.remove}
        />
      </MobileSheet>

      <MobileSheet
        open={mobilePanel === 'models'}
        title={mobileText.switchModel}
        onClose={() => setMobilePanel(null)}
        fullHeight
      >
        <MobileModelPanel
          modelGroups={modelGroups}
          activeModel={activeModel}
          activeModelMeta={activeModelMeta}
          mobileText={mobileText}
          modelMetaLabels={modelMetaLabels}
          selectedModelLabel={selectedModelLabel}
          onSelectModel={handleSelectModel}
        />
      </MobileSheet>

      <MobileSheet open={mobilePanel === 'tools'} title={mobileText.tools} onClose={() => setMobilePanel(null)}>
        <MobileToolsPanel
          permissions={permissions}
          libraryItems={libraryItems}
          mobileText={mobileText}
          mode={mode}
          onOpenInfo={() => {
            setMobilePanel(null)
            setInfoOpen(true)
          }}
          onOpenSettings={() => {
            setMobilePanel(null)
            setSettingsOpen(true)
          }}
          onOpenVoice={() => {
            setMobilePanel(null)
            setVoiceOpen(true)
          }}
        />
      </MobileSheet>

      <MobileSheet open={mobilePanel === 'account'} title={mobileText.account} onClose={() => setMobilePanel(null)}>
        <MobileAccountPanel
          session={session}
          workspaceSummary={workspaceSummary}
          permissions={permissions}
          modelGroups={modelGroups}
          layoutPreference={layoutPreference}
          mobileText={mobileText}
          formatNumber={formatNumber}
          onLayoutPreferenceChange={setLayoutPreference}
          onLogout={onLogout}
          onOpenAdmin={onOpenAdmin}
          onOpenSettings={() => {
            setMobilePanel(null)
            setSettingsOpen(true)
          }}
          onSwitchToModels={() => setMobilePanel('models')}
        />
      </MobileSheet>
    </div>
  )

  return (
    <main
      className={clsx(
        'relative bg-[#f7f7f8] text-ink',
        resolvedMode === 'mobile' ? 'h-[100dvh] overflow-hidden' : 'h-screen overflow-auto',
      )}
    >
      {resolvedMode === 'mobile' ? mobileShell : desktopShell}

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
      <SettingsModal open={settingsOpen} section="general" onClose={() => setSettingsOpen(false)} />
      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </main>
  )
}
