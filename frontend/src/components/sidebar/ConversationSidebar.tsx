import clsx from 'clsx'
import { LogOut, MessageSquarePlus, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AuthSession } from '../../types/auth'
import type { Conversation } from '../../types/chat'

interface ConversationSidebarProps {
  session: AuthSession
  conversations: Conversation[]
  currentConversationId?: string
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onLogout: () => void
  onOpenAdmin?: () => void
}

export const ConversationSidebar = ({
  session,
  conversations,
  currentConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onLogout,
  onOpenAdmin,
}: ConversationSidebarProps) => {
  const { t } = useI18n()
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editingConversationId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingConversationId])

  const startRename = (conversationId: string, title: string) => {
    setEditingConversationId(conversationId)
    setEditingTitle(title)
  }

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
    <aside className="relative flex h-screen w-[286px] shrink-0 flex-col overflow-hidden border-r border-[rgb(var(--border))] bg-[rgb(var(--sidebar-bg))]">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 px-1 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1c1c1e] text-[12px] font-bold tracking-tight text-white shadow-sm">
            AU
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-[rgb(var(--text))]">Aurora</p>
            <p className="text-[12px] text-[rgb(var(--subtle))]">Workspace</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateConversation}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2.5 text-[13px] font-medium text-[rgb(var(--text))] shadow-sm transition-all duration-150 hover:border-[rgb(var(--accent))]/30 hover:shadow-md active:scale-[0.99]"
        >
          <MessageSquarePlus size={15} className="text-[rgb(var(--accent))]" />
          <span>{t('chat.newChat')}</span>
        </button>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
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
                  'group relative flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all duration-150',
                  isActive
                    ? 'bg-[rgb(var(--surface))] shadow-sm ring-1 ring-black/5'
                    : 'hover:bg-[rgb(var(--surface))]/70',
                )}
              >
                {isActive ? (
                  <span className="absolute left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[rgb(var(--accent))]" />
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  {editingConversationId === conversation.id ? (
                    <input
                      ref={inputRef}
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 text-[13px] leading-5 outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/20"
                    />
                  ) : (
                    <p className={clsx(
                      'line-clamp-2 text-[13px] leading-5',
                      isActive ? 'font-medium text-[rgb(var(--text))]' : 'text-[rgb(var(--muted))]',
                    )}>{conversation.title}</p>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${conversation.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    startRename(conversation.id, conversation.title)
                  }}
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--subtle))] transition hover:bg-black/5 hover:text-[rgb(var(--text))]',
                    isActive || editingConversationId === conversation.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${conversation.title}`}
                  onClick={handleDelete}
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--subtle))] transition hover:bg-red-50 hover:text-[rgb(var(--danger))]',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[rgb(var(--border))] p-4">
        <div className="flex items-center gap-3 rounded-xl bg-[rgb(var(--surface))] px-3 py-2.5 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-[11px] font-semibold text-[rgb(var(--accent))]">
            {session.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[rgb(var(--text))]">{session.name}</p>
            <p className="truncate text-[12px] text-[rgb(var(--subtle))]">{session.email}</p>
          </div>
          {session.role === 'admin' && onOpenAdmin ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="管理后台"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--subtle))] transition hover:bg-black/5 hover:text-[rgb(var(--text))]"
            >
              <ShieldCheck size={15} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            title="退出登录"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--subtle))] transition hover:bg-black/5 hover:text-[rgb(var(--text))]"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
