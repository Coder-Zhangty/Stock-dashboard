import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { streamChat } from '../services/chat'
import {
  createConversationRemote,
  deleteConversationRemote,
  fetchAccountConversations,
  importLocalConversationsRemote,
  replaceConversationMessagesRemote,
  updateConversationRemote,
} from '../services/conversations'
import {
  hasImportedLocalConversations,
  loadConversations,
  markLocalConversationsImported,
  saveConversations,
} from '../lib/storage'
import type { AuthSession } from '../types/auth'
import type {
  EditMessagePayload,
  ChatPayload,
  ChatRequestMessage,
  Conversation,
} from '../types/chat'
import {
  createConversation,
  createMessage,
  deriveConversationTitle,
} from '../utils/chat'

const sortConversations = (conversations: Conversation[]) =>
  [...conversations].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )

const withoutSystemMessages = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: conversation.messages.filter((message) => message.role !== 'system'),
})

const getInitialConversations = (userId: string) => {
  const saved = loadConversations(userId)
  return saved.length
    ? sortConversations(saved.map(withoutSystemMessages))
    : [createConversation()]
}

interface UseChatOptions {
  session: AuthSession
}

interface ConversationDefaults {
  selectedModelId?: string | null
  selectedProviderId?: string | null
  autoModelStrategy?: string | null
}

interface UpdateConversationModelInput {
  conversationId: string
  modelId: string
  providerId?: string | null
  autoModelStrategy?: string | null
  traceContent?: string | null
}

export const useChat = ({ session }: UseChatOptions) => {
  const [initialState] = useState(() => {
    const initialConversations = getInitialConversations(session.userId)

    return {
      conversations: initialConversations,
      currentConversationId: initialConversations[0].id,
    }
  })
  const [conversations, setConversations] = useState<Conversation[]>(
    initialState.conversations,
  )
  const [currentConversationId, setCurrentConversationId] = useState<string>(
    initialState.currentConversationId,
  )
  const [isSending, setIsSending] = useState(false)
  const isSendingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationDefaultsRef = useRef<ConversationDefaults>({
    selectedModelId: null,
    selectedProviderId: null,
    autoModelStrategy: null,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      saveConversations(conversations, session.userId)
    }, 500)
    return () => clearTimeout(timer)
  }, [conversations, session.userId])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const hydrateAccountHistory = async () => {
      const localConversations = loadConversations(session.userId)
        .map(withoutSystemMessages)
        .filter((conversation) => conversation.messages.length > 0)
      const shouldImport =
        !hasImportedLocalConversations(session.userId) &&
        localConversations.some((conversation) => !conversation.remoteId)

      try {
        if (shouldImport) {
          await importLocalConversationsRemote(
            localConversations.filter((conversation) => !conversation.remoteId),
          )
          markLocalConversationsImported(session.userId)
        }
        const remoteConversations = sortConversations(await fetchAccountConversations())
        if (cancelled) return
        if (remoteConversations.length > 0) {
          setConversations(remoteConversations)
          setCurrentConversationId((currentId) =>
            remoteConversations.some((conversation) => conversation.id === currentId)
              ? currentId
              : remoteConversations[0].id,
          )
          return
        }
        if (shouldImport) {
          markLocalConversationsImported(session.userId)
        }
      } catch {
        if (shouldImport) {
          // Keep the cache intact so a later login can retry the one-time migration.
          return
        }
      }
    }

    void hydrateAccountHistory()

    return () => {
      cancelled = true
    }
  }, [session.userId])

  const currentConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === currentConversationId) ??
      conversations[0],
    [conversations, currentConversationId],
  )

  const updateConversation = (
    conversationId: string,
    updater: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((current) =>
      sortConversations(
        current.map((conversation) =>
          conversation.id === conversationId ? updater(conversation) : conversation,
        ),
      ),
    )
  }

  const handleCreateConversation = () => {
    const next = createConversation(conversationDefaultsRef.current)
    setConversations((current) => [next, ...current])
    setCurrentConversationId(next.id)
    setError(null)

    void createConversationRemote({
      title: next.title,
      selectedModelId: next.selectedModelId,
      autoModelStrategy: next.autoModelStrategy,
    })
      .then((remote) => {
        setConversations((current) =>
          sortConversations(
            current.map((conversation) =>
              conversation.id === next.id
                ? {
                    ...conversation,
                    id: remote.id,
                    remoteId: remote.remoteId,
                    createdAt: remote.createdAt,
                    updatedAt: remote.updatedAt,
                  }
                : conversation,
            ),
          ),
        )
        setCurrentConversationId((currentId) =>
          currentId === next.id ? remote.id : currentId,
        )
      })
      .catch(() => {
        // The optimistic conversation remains usable; sending the first message will create it server-side.
      })
  }

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId)
    setError(null)
  }

  const handleDeleteConversation = (conversationId: string) => {
    const target = conversations.find((conversation) => conversation.id === conversationId)
    setConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== conversationId,
      )

      if (remaining.length === 0) {
        const fallback = createConversation()
        setCurrentConversationId(fallback.id)
        return [fallback]
      }

      if (conversationId === currentConversationId) {
        setCurrentConversationId(remaining[0].id)
      }

      return remaining
    })
    setError(null)
    if (target?.remoteId) {
      void deleteConversationRemote(target.remoteId).catch(() => undefined)
    }
  }

  const handleRenameConversation = (conversationId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: trimmed,
      isCustomTitle: true,
      updatedAt: new Date().toISOString(),
    }))
    setError(null)
    const remoteId = conversations.find((conversation) => conversation.id === conversationId)?.remoteId
    if (remoteId) {
      void updateConversationRemote(remoteId, { title: trimmed }).catch(() => undefined)
    }
  }

  const setConversationDefaults = useCallback((defaults: ConversationDefaults) => {
    conversationDefaultsRef.current = {
      selectedModelId: defaults.selectedModelId ?? null,
      selectedProviderId: defaults.selectedProviderId ?? null,
      autoModelStrategy: defaults.autoModelStrategy ?? null,
    }

    setConversations((current) =>
      sortConversations(
        current.map((conversation) =>
          conversation.selectedModelId || conversation.selectedProviderId
            ? conversation
            : {
                ...conversation,
                selectedModelId:
                  defaults.selectedModelId ?? conversation.selectedModelId ?? null,
                selectedProviderId:
                  defaults.selectedProviderId ?? conversation.selectedProviderId ?? null,
                autoModelStrategy:
                  defaults.autoModelStrategy ?? conversation.autoModelStrategy ?? null,
              },
        ),
      ),
    )
  }, [])

  const updateConversationModel = async ({
    conversationId,
    modelId,
    providerId = null,
    autoModelStrategy = null,
    traceContent,
  }: UpdateConversationModelInput) => {
    const targetConversation = conversations.find(
      (conversation) => conversation.id === conversationId,
    )
    if (!targetConversation) return

    if (
      targetConversation.selectedModelId === modelId &&
      (providerId === null || targetConversation.selectedProviderId === providerId) &&
      (autoModelStrategy === null ||
        targetConversation.autoModelStrategy === autoModelStrategy)
    ) {
      return
    }

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      selectedModelId: modelId,
      selectedProviderId: providerId ?? conversation.selectedProviderId ?? null,
      autoModelStrategy,
      updatedAt: new Date().toISOString(),
      messages: conversation.messages.filter((message) => message.role !== 'system'),
    }))

    const remoteId = targetConversation.remoteId
    if (!remoteId) return

    try {
      await updateConversationRemote(remoteId, {
        selectedModelId: modelId,
        autoModelStrategy,
      })
    } catch {
      // Keep the local conversation responsive; the next send will resync the model.
    }
  }

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }

  const sendMessage = async ({
    content,
    model,
    mode,
    attachments = [],
    marketContext = null,
  }: ChatPayload) => {
    const trimmed = content.trim()
    if (!trimmed || !currentConversation || isSendingRef.current) return

    isSendingRef.current = true
    setIsSending(true)
    setError(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    const userMessage = createMessage('user', trimmed, 'idle', attachments)
    const assistantMessage = createMessage('assistant', '', 'streaming')
    const now = new Date().toISOString()
    const nextTitle =
      currentConversation.messages.length === 0 && !currentConversation.isCustomTitle
        ? deriveConversationTitle(trimmed)
        : currentConversation.title

    const selectedModelId =
      currentConversation.selectedModelId ??
      model ??
      conversationDefaultsRef.current.selectedModelId ??
      undefined
    const selectedMode =
      currentConversation.autoModelStrategy ??
      mode ??
      conversationDefaultsRef.current.autoModelStrategy ??
      undefined

    const requestMessages: ChatRequestMessage[] = [
      ...currentConversation.messages,
      userMessage,
    ]
      .filter((message) => message.role !== 'system')
      .map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }))

    updateConversation(currentConversation.id, (conversation) => ({
      ...conversation,
      title: nextTitle,
      updatedAt: now,
      selectedModelId: selectedModelId ?? conversation.selectedModelId ?? null,
      autoModelStrategy: selectedMode ?? conversation.autoModelStrategy ?? null,
      messages: [...conversation.messages, userMessage, assistantMessage],
    }))

    try {
      await streamChat({
        messages: requestMessages,
        conversationId: currentConversation.remoteId ?? currentConversation.id,
        model: selectedModelId,
        mode: selectedMode ?? undefined,
        attachments,
        marketContext,
        signal: controller.signal,
        onChunk: (chunk) => {
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: `${message.content}${chunk}`,
                    status: 'streaming',
                  }
                : message,
            ),
          }))
        },
        onDone: (usage) => {
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            remoteId: usage?.conversationId ?? conversation.remoteId ?? null,
            selectedModelId: usage?.model || conversation.selectedModelId,
            selectedProviderId: usage?.provider || conversation.selectedProviderId,
            autoModelStrategy: selectedMode ?? conversation.autoModelStrategy ?? null,
            messages: conversation.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, status: 'idle', usage }
                : message,
            ),
          }))
        },
        onError: (message) => {
          setError(message)
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((entry) =>
              entry.id === assistantMessage.id
                ? {
                    ...entry,
                    content:
                      entry.content || 'The assistant did not return a usable response.',
                    status: 'error',
                  }
                : entry,
            ),
          }))
        },
      })
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === 'AbortError') {
        updateConversation(currentConversation.id, (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: conversation.messages
            .filter(
              (message) =>
                message.id !== assistantMessage.id || message.content.trim().length > 0,
            )
            .map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    status: 'cancelled',
                  }
                : message,
            ),
        }))
        return
      }

      const fallbackMessage =
        streamError instanceof Error ? streamError.message : 'Unable to send message.'
      setError(fallbackMessage)
      updateConversation(currentConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: new Date().toISOString(),
        messages: conversation.messages.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                content: fallbackMessage,
                status: 'error',
              }
            : message,
        ),
      }))
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const editMessage = async ({
    messageId,
    content,
    model,
    mode,
    marketContext = null,
  }: EditMessagePayload) => {
    const trimmed = content.trim()
    if (!trimmed || !currentConversation || isSendingRef.current) return

    const messageIndex = currentConversation.messages.findIndex(
      (message) => message.id === messageId && message.role === 'user',
    )
    if (messageIndex < 0) return

    isSendingRef.current = true
    setIsSending(true)
    setError(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    const selectedModelId =
      currentConversation.selectedModelId ??
      model ??
      conversationDefaultsRef.current.selectedModelId ??
      undefined
    const selectedMode =
      currentConversation.autoModelStrategy ??
      mode ??
      conversationDefaultsRef.current.autoModelStrategy ??
      undefined

    const originalMessage = currentConversation.messages[messageIndex]
    const editedUserMessage = {
      ...originalMessage,
      content: trimmed,
      status: 'idle' as const,
      createdAt: new Date().toISOString(),
    }
    const assistantMessage = createMessage('assistant', '', 'streaming')
    const retainedMessages = currentConversation.messages.slice(0, messageIndex)
    const requestMessages: ChatRequestMessage[] = [
      ...retainedMessages,
      editedUserMessage,
    ]
      .filter((message) => message.role !== 'system')
      .map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }))
    const nextTitle =
      messageIndex === 0 && !currentConversation.isCustomTitle
        ? deriveConversationTitle(trimmed)
        : currentConversation.title

    updateConversation(currentConversation.id, (conversation) => ({
      ...conversation,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
      selectedModelId: selectedModelId ?? conversation.selectedModelId ?? null,
      autoModelStrategy: selectedMode ?? conversation.autoModelStrategy ?? null,
      messages: [...retainedMessages, editedUserMessage, assistantMessage],
    }))

    try {
      if (currentConversation.remoteId) {
        await replaceConversationMessagesRemote(currentConversation.remoteId, retainedMessages)
      }
      await streamChat({
        messages: requestMessages,
        conversationId: currentConversation.remoteId ?? currentConversation.id,
        model: selectedModelId,
        mode: selectedMode ?? undefined,
        attachments: [],
        marketContext,
        signal: controller.signal,
        onChunk: (chunk) => {
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: `${message.content}${chunk}`,
                    status: 'streaming',
                  }
                : message,
            ),
          }))
        },
        onDone: (usage) => {
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            remoteId: usage?.conversationId ?? conversation.remoteId ?? null,
            selectedModelId: usage?.model || conversation.selectedModelId,
            selectedProviderId: usage?.provider || conversation.selectedProviderId,
            autoModelStrategy: selectedMode ?? conversation.autoModelStrategy ?? null,
            messages: conversation.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, status: 'idle', usage }
                : message,
            ),
          }))
        },
        onError: (message) => {
          setError(message)
          updateConversation(currentConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((entry) =>
              entry.id === assistantMessage.id
                ? {
                    ...entry,
                    content:
                      entry.content || 'The assistant did not return a usable response.',
                    status: 'error',
                  }
                : entry,
            ),
          }))
        },
      })
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === 'AbortError') {
        updateConversation(currentConversation.id, (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: conversation.messages
            .filter(
              (message) =>
                message.id !== assistantMessage.id || message.content.trim().length > 0,
            )
            .map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    status: 'cancelled',
                  }
                : message,
            ),
        }))
        return
      }

      const fallbackMessage =
        streamError instanceof Error ? streamError.message : 'Unable to update message.'
      setError(fallbackMessage)
      updateConversation(currentConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: new Date().toISOString(),
        messages: conversation.messages.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                content: fallbackMessage,
                status: 'error',
              }
            : message,
        ),
      }))
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  return {
    conversations,
    currentConversation,
    currentConversationId,
    isSending,
    error,
    createConversation: handleCreateConversation,
    selectConversation: handleSelectConversation,
    deleteConversation: handleDeleteConversation,
    renameConversation: handleRenameConversation,
    setConversationDefaults,
    updateConversationModel,
    sendMessage,
    editMessage,
    stopStreaming,
  }
}
