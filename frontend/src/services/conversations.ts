import { requestJson } from './api'
import { readStoredToken } from './auth'
import type { ChatAttachment, ChatMessage, Conversation } from '../types/chat'

interface UpdateConversationPayload {
  title?: string
  selectedModelId?: string | null
  autoModelStrategy?: string | null
  archived?: boolean
}

interface ConversationDto {
  id: string
  user_id: string
  title: string
  selected_model_id: string | null
  auto_model_strategy: string | null
  last_message_at: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

interface MessageDto {
  id: string
  conversation_id: string
  user_id: string | null
  role: ChatMessage['role']
  content_text: string
  model_id: string | null
  provider_id: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  estimated_cost: number | null
  created_at: string
  attachments?: Array<{
    id: string
    name: string
    type: string
    source: string | null
    size_label?: string | null
    created_at?: string | null
  }>
}

const toAttachment = (attachment: NonNullable<MessageDto['attachments']>[number]): ChatAttachment => ({
  id: attachment.id,
  name: attachment.name,
  type: attachment.type,
  source: attachment.source ?? 'upload',
  sizeLabel: attachment.size_label ?? null,
  createdAt: attachment.created_at ?? null,
})

const toConversation = (
  conversation: ConversationDto,
  messages: ChatMessage[] = [],
): Conversation => ({
  id: conversation.id,
  remoteId: conversation.id,
  title: conversation.title,
  isCustomTitle: true,
  createdAt: conversation.created_at,
  updatedAt: conversation.updated_at,
  selectedModelId: conversation.selected_model_id,
  selectedProviderId: null,
  autoModelStrategy: conversation.auto_model_strategy,
  messages,
})

const toMessage = (message: MessageDto): ChatMessage => ({
  id: message.id,
  role: message.role,
  content: message.content_text,
  createdAt: message.created_at,
  status: 'idle',
  attachments: (message.attachments ?? []).map(toAttachment),
  usage:
    message.role === 'assistant' && message.model_id
      ? {
          provider: message.provider_id ?? '',
          model: message.model_id,
          mode: '',
          promptTokens: message.prompt_tokens ?? 0,
          completionTokens: message.completion_tokens ?? 0,
          totalTokens: message.total_tokens ?? 0,
          estimatedCost: message.estimated_cost ?? 0,
          requestStatus: 'success',
          conversationId: message.conversation_id,
        }
      : null,
})

const toImportMessage = (message: ChatMessage) => ({
  role: message.role,
  content_text: message.content,
  created_at: message.createdAt,
  attachments: (message.attachments ?? []).map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    source: attachment.source,
    size_label: attachment.sizeLabel,
    created_at: attachment.createdAt,
  })),
})

export const listConversationsRemote = async (): Promise<ConversationDto[]> => {
  const token = readStoredToken()
  return requestJson<ConversationDto[]>('/api/conversations', { token })
}

export const listConversationMessagesRemote = async (
  conversationId: string,
): Promise<ChatMessage[]> => {
  const token = readStoredToken()
  const response = await requestJson<MessageDto[]>(
    `/api/conversations/${conversationId}/messages`,
    { token },
  )
  return response.map(toMessage)
}

export const fetchAccountConversations = async (): Promise<Conversation[]> => {
  const conversations = await listConversationsRemote()
  const withMessages = await Promise.all(
    conversations.map(async (conversation) =>
      toConversation(
        conversation,
        await listConversationMessagesRemote(conversation.id),
      ),
    ),
  )
  return withMessages
}

export const createConversationRemote = async (payload: {
  title?: string
  selectedModelId?: string | null
  autoModelStrategy?: string | null
} = {}) => {
  const token = readStoredToken()
  const response = await requestJson<ConversationDto>('/api/conversations', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      selected_model_id: payload.selectedModelId,
      auto_model_strategy: payload.autoModelStrategy,
    }),
  })
  return toConversation(response)
}

export const updateConversationRemote = async (
  conversationId: string,
  payload: UpdateConversationPayload,
) => {
  const token = readStoredToken()
  return requestJson<ConversationDto>(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      selected_model_id: payload.selectedModelId,
      auto_model_strategy: payload.autoModelStrategy,
      archived: payload.archived,
    }),
  })
}

export const deleteConversationRemote = async (conversationId: string) => {
  const token = readStoredToken()
  await requestJson<{ success: boolean }>(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
    token,
  })
}

export const importLocalConversationsRemote = async (
  conversations: Conversation[],
) => {
  const token = readStoredToken()
  const response = await requestJson<ConversationDto[]>('/api/conversations/import-local', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversations: conversations
        .filter((conversation) => conversation.messages.length > 0)
        .map((conversation) => ({
          client_id: conversation.id,
          title: conversation.title,
          selected_model_id: conversation.selectedModelId,
          auto_model_strategy: conversation.autoModelStrategy,
          created_at: conversation.createdAt,
          updated_at: conversation.updatedAt,
          messages: conversation.messages
            .filter((message) => message.role !== 'system')
            .map(toImportMessage),
        })),
    }),
  })
  return response.map((conversation) => toConversation(conversation))
}

export const replaceConversationMessagesRemote = async (
  conversationId: string,
  messages: ChatMessage[],
) => {
  const token = readStoredToken()
  const response = await requestJson<MessageDto[]>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: 'PUT',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages
          .filter((message) => message.role !== 'system')
          .map(toImportMessage),
      }),
    },
  )
  return response.map(toMessage)
}
