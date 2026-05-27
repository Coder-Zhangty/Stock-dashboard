import type { Conversation } from '../types/chat'

// Conversation histories are cached in localStorage as plaintext JSON for offline
// access and quick startup. This is not encrypted — any XSS on the same origin or
// browser extension with storage access can read all chat messages. Auth tokens
// use httpOnly cookies (not localStorage), so credentials are not exposed here.
const STORAGE_KEY = 'aurora-chat-conversations'
const IMPORTED_KEY = 'aurora-chat-imported'

const resolveKey = (userId?: string) =>
  userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY

export const loadConversations = (userId?: string): Conversation[] => {
  try {
    const raw = localStorage.getItem(resolveKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw) as Conversation[]
    if (!Array.isArray(parsed)) return []

    return parsed.map((conversation) => ({
      ...conversation,
      remoteId: conversation.remoteId ?? null,
      selectedModelId: conversation.selectedModelId ?? null,
      selectedProviderId: conversation.selectedProviderId ?? null,
      autoModelStrategy: conversation.autoModelStrategy ?? null,
    }))
  } catch {
    return []
  }
}

export const saveConversations = (conversations: Conversation[], userId?: string) => {
  localStorage.setItem(resolveKey(userId), JSON.stringify(conversations))
}

export const hasImportedLocalConversations = (userId?: string) => {
  try {
    return localStorage.getItem(userId ? `${IMPORTED_KEY}:${userId}` : IMPORTED_KEY) === '1'
  } catch {
    return true
  }
}

export const markLocalConversationsImported = (userId?: string) => {
  try {
    localStorage.setItem(userId ? `${IMPORTED_KEY}:${userId}` : IMPORTED_KEY, '1')
  } catch {
    // Local persistence is only a cache; account history lives on the server.
  }
}
