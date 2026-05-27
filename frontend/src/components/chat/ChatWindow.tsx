import clsx from 'clsx'
import { ArrowDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { ChatMessage, Conversation } from '../../types/chat'
import { MessageBubble } from './MessageBubble'

interface ChatWindowProps {
  conversation?: Conversation
  isSending: boolean
  onEditMessage: (message: ChatMessage) => void
}

export const ChatWindow = ({ conversation, isSending, onEditMessage }: ChatWindowProps) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const shouldFollowRef = useRef(true)
  const lastConversationIdRef = useRef<string | null>(null)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)

  const visibleMessages = useMemo(
    () => conversation?.messages.filter((message) => message.role !== 'system') ?? [],
    [conversation?.messages],
  )

  const scrollAnchor = useMemo(() => {
    const lastMessage = visibleMessages.at(-1)
    return [
      conversation?.id ?? '',
      lastMessage?.id ?? '',
      lastMessage?.role ?? '',
      lastMessage?.status ?? '',
      lastMessage?.content.length ?? 0,
      isSending ? 'sending' : 'idle',
    ].join(':')
  }, [conversation?.id, visibleMessages, isSending])

  const isNearBottom = useCallback((element: HTMLDivElement) => {
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    return distance < 96
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const element = scrollContainerRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
    shouldFollowRef.current = true
    setShowJumpToBottom(false)
  }, [])

  const handleScroll = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) return
    const nearBottom = isNearBottom(element)
    shouldFollowRef.current = nearBottom
    if (nearBottom) setShowJumpToBottom(false)
  }, [isNearBottom])

  // Ensure scroll to bottom on first mount (overlay open)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    // Double RAF ensures flex layout has fully resolved before scrolling
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToBottom('auto'))
    })
  }, [scrollToBottom])

  useLayoutEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    const conversationChanged = lastConversationIdRef.current !== (conversation?.id ?? null)
    lastConversationIdRef.current = conversation?.id ?? null

    if (conversationChanged) {
      shouldFollowRef.current = true
      setShowJumpToBottom(false)
      window.requestAnimationFrame(() => scrollToBottom('auto'))
      return
    }

    if (!shouldFollowRef.current) {
      if (!isNearBottom(element)) setShowJumpToBottom(true)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(isSending ? 'auto' : 'smooth')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [conversation?.id, isNearBottom, isSending, scrollAnchor, scrollToBottom])

  if (!conversation || visibleMessages.length === 0) return null

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="chat-scroll relative h-full overflow-y-auto overscroll-contain"
    >
      <div
        key={conversation.id}
        className="mx-auto flex w-full max-w-[860px] flex-col px-4 pt-6 sm:px-6 sm:pt-12"
      >
        {visibleMessages.map((message, index) => (
          <MessageBubble
            key={`${conversation.id}-${message.id}-${index}`}
            message={message}
            onEdit={onEditMessage}
          />
        ))}
        <div className="h-36 shrink-0 sm:h-44" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={() => scrollToBottom('smooth')}
        className={clsx(
          'sticky bottom-4 left-1/2 z-20 mx-auto -mt-12 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] shadow-md transition-all duration-200 hover:shadow-lg',
          showJumpToBottom
            ? 'pointer-events-auto opacity-100 scale-100 translate-y-0'
            : 'pointer-events-none opacity-0 scale-75 translate-y-2',
        )}
        aria-label="Back to bottom"
        tabIndex={showJumpToBottom ? 0 : -1}
      >
        <ArrowDown size={14} />
      </button>
    </div>
  )
}
