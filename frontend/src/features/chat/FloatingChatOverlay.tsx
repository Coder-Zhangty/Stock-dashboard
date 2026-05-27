import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Plus, X, ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react'

import { useChatContext } from '../../contexts/ChatContext'
import { ChatWindow } from '../../components/chat/ChatWindow'
import { Composer } from '../../components/chat/Composer'
import { EmptyState } from '../../components/chat/EmptyState'
import ContextIndicator from '../../components/chat/ContextIndicator'
import type { ChatAttachment, ChatMessage } from '../../types/chat'

export default function FloatingChatOverlay() {
  const ctx = useChatContext()
  const { isLoggedIn, isOverlayOpen, setOverlayOpen } = ctx

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOverlayOpen) setOverlayOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOverlayOpen, setOverlayOpen])

  if (!isLoggedIn) {
    return <FAB onClick={() => setOverlayOpen(true)} />
  }

  return (
    <>
      <FAB onClick={() => setOverlayOpen(true)} />
      {isOverlayOpen && <OverlayPanel onClose={() => setOverlayOpen(false)} />}
    </>
  )
}

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 w-[52px] h-[52px] rounded-full bg-accent-blue text-white shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      title="AI助手"
    >
      <Bot size={24} />
    </button>
  )
}

function OverlayPanel({ onClose }: { onClose: () => void }) {
  const ctx = useChatContext()
  const { isSending, permissions, libraryItems } = ctx

  const conversation = ctx.currentConversation
  const messages = conversation?.messages.filter((m) => m.role !== 'system') ?? []
  const hasMessages = messages.length > 0

  const [showConversations, setShowConversations] = useState(false)
  const [draft, setDraft] = useState(ctx.draft)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(ctx.editingMessage)

  // Resizable panel
  const [panelWidth, setPanelWidth] = useState(440)
  const [panelHeight, setPanelHeight] = useState(window.innerHeight * 0.65)
  const resizingRef = useRef<'left' | 'top' | 'top-left' | 'top-right' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current || !panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()

      switch (resizingRef.current) {
        case 'left':
          setPanelWidth(Math.min(800, Math.max(360, rect.right - e.clientX)))
          break
        case 'top':
          setPanelHeight(Math.min(window.innerHeight * 0.9, Math.max(320, rect.bottom - e.clientY)))
          break
        case 'top-left':
          setPanelWidth(Math.min(800, Math.max(360, rect.right - e.clientX)))
          setPanelHeight(Math.min(window.innerHeight * 0.9, Math.max(320, rect.bottom - e.clientY)))
          break
        case 'top-right':
          setPanelHeight(Math.min(window.innerHeight * 0.9, Math.max(320, rect.bottom - e.clientY)))
          break
      }
    }
    const onMouseUp = () => {
      if (resizingRef.current) {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      resizingRef.current = null
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const beginResize = (handle: 'left' | 'top' | 'top-left' | 'top-right') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = handle
    const cursors = { left: 'ew-resize', top: 'ns-resize', 'top-left': 'nwse-resize', 'top-right': 'ns-resize' }
    document.body.style.cursor = cursors[handle]
    document.body.style.userSelect = 'none'
  }

  useEffect(() => { ctx.setDraft(draft) }, [draft, ctx.setDraft])
  useEffect(() => { ctx.setEditingMessage(editingMessage) }, [editingMessage, ctx.setEditingMessage])

  const handleSend = useCallback(
    async (payload: { content: string; attachments: ChatAttachment[]; mode?: string | null }) => {
      const trimmed = payload.content.trim()
      if (!trimmed || ctx.isSending) return

      if (editingMessage) {
        await ctx.editMessage({ messageId: editingMessage.id, content: trimmed })
        setEditingMessage(null)
      } else {
        await ctx.sendMessage({
          content: trimmed,
          model: ctx.activeModel,
          mode: payload.mode ?? undefined,
          attachments: payload.attachments,
        })
      }
      setDraft('')
    },
    [ctx.isSending, ctx.editMessage, ctx.sendMessage, ctx.activeModel, editingMessage],
  )

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setDraft(message.content)
    setEditingMessage(message)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
    setDraft('')
  }, [])

  const handleNewChat = useCallback(() => {
    ctx.createConversation()
    setShowConversations(false)
  }, [ctx.createConversation])

  const handleSelectConversation = useCallback((id: string) => {
    ctx.selectConversation(id)
    setShowConversations(false)
  }, [ctx.selectConversation])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Resize handles — desktop only */}
      {/* Left edge */}
      <div
        className="fixed z-40 hidden md:flex items-center group"
        style={{ right: panelWidth - 4, bottom: 20, width: 14, height: panelHeight - 36, cursor: 'ew-resize' }}
        onMouseDown={beginResize('left')}
      >
        <div className="w-full h-12 rounded-full bg-white/0 group-hover:bg-white/10 transition-colors flex items-center justify-center mx-auto">
          <div className="w-1 h-8 rounded-full bg-white/0 group-hover:bg-white/20 transition-colors" />
        </div>
      </div>

      {/* Top edge */}
      <div
        className="fixed z-40 hidden md:flex justify-center group"
        style={{ right: 20, bottom: panelHeight - 4, width: panelWidth - 36, height: 14, cursor: 'ns-resize' }}
        onMouseDown={beginResize('top')}
      >
        <div className="h-full w-12 rounded-full bg-white/0 group-hover:bg-white/10 transition-colors flex items-center justify-center">
          <div className="h-1 w-8 rounded-full bg-white/0 group-hover:bg-white/20 transition-colors" />
        </div>
      </div>

      {/* Top-left corner */}
      <div
        className="fixed z-40 hidden md:flex items-center justify-center group"
        style={{ right: panelWidth - 10, bottom: panelHeight - 10, width: 22, height: 22, cursor: 'nwse-resize' }}
        onMouseDown={beginResize('top-left')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" className="opacity-0 group-hover:opacity-40 transition-opacity">
          <path d="M1 11L11 1M7 11L11 7M10 11L11 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Top-right corner (vertical only, right edge is at screen edge) */}
      <div
        className="fixed z-40 hidden md:flex items-center justify-center group"
        style={{ right: -4, bottom: panelHeight - 10, width: 22, height: 22, cursor: 'ns-resize' }}
        onMouseDown={beginResize('top-right')}
      >
        <div className="h-3 w-1 rounded-full bg-white/0 group-hover:bg-white/20 transition-colors" />
      </div>

      <div
        ref={panelRef}
        className="chat-panel fixed bottom-0 right-0 z-40 w-full h-[100dvh] md:rounded-t-2xl shadow-2xl border border-[rgb(var(--border))] flex flex-col animate-slide-up overflow-hidden"
        style={{
          width: `min(${panelWidth}px, 100vw)`,
          height: `min(${panelHeight}px, 100dvh)`,
        }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setShowConversations(!showConversations)}
              className="p-1 rounded hover:bg-white/10 text-[rgb(var(--subtle))]"
            >
              {showConversations ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <span className="text-xs font-medium text-[rgb(var(--text))] truncate">
              {conversation?.title ?? 'AI 助手'}
            </span>
            <ContextIndicator context={ctx.marketContext} />
          </div>
          <button onClick={handleNewChat} className="p-1 rounded hover:bg-white/10 text-[rgb(var(--subtle))]" title="新对话">
            <Plus size={14} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-[rgb(var(--subtle))]">
            <X size={14} />
          </button>
        </div>

        {/* Conversation list */}
        {showConversations && (
          <div className="shrink-0 max-h-[40%] overflow-y-auto border-b border-[rgb(var(--border))]">
            {ctx.conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-white/5 text-xs ${
                  conv.id === conversation?.id ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))]' : 'text-[rgb(var(--muted))]'
                }`}
              >
                <MessageSquare size={12} className="shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); ctx.deleteConversation(conv.id) }}
                  className="p-0.5 rounded hover:bg-red-500/20 text-[rgb(var(--muted))] hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messages area */}
        {hasMessages ? (
          <>
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0">
                <ChatWindow conversation={conversation!} isSending={isSending} onEditMessage={handleEditMessage} />
              </div>
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
              onStop={ctx.stopStreaming}
              onUploadFiles={ctx.handleUploadFiles}
              onSend={handleSend}
            />
          </>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
            <div className="w-full max-w-[520px]">
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
                  onStop={ctx.stopStreaming}
                  onUploadFiles={ctx.handleUploadFiles}
                  onSend={handleSend}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
