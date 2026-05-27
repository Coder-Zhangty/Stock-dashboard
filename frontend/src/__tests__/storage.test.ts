import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadConversations, saveConversations, hasImportedLocalConversations, markLocalConversationsImported } from '../lib/storage'
import type { Conversation } from '../types/chat'

const mockConversation: Conversation = {
  id: 'conv-1',
  title: 'Test Chat',
  messages: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  remoteId: null,
  selectedModelId: null,
  selectedProviderId: null,
  autoModelStrategy: null,
}

describe('loadConversations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no data', () => {
    expect(loadConversations()).toEqual([])
  })

  it('loads saved conversations', () => {
    saveConversations([mockConversation])
    const result = loadConversations()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('conv-1')
  })

  it('returns empty array for corrupted data', () => {
    localStorage.setItem('aurora-chat-conversations', 'not-json')
    expect(loadConversations()).toEqual([])
  })

  it('filters non-array data', () => {
    localStorage.setItem('aurora-chat-conversations', JSON.stringify({ foo: 'bar' }))
    expect(loadConversations()).toEqual([])
  })

  it('scopes by userId', () => {
    saveConversations([mockConversation], 'user123')
    expect(loadConversations('user123')).toHaveLength(1)
    expect(loadConversations('user456')).toEqual([])
  })
})

describe('saveConversations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves to localStorage', () => {
    saveConversations([mockConversation])
    const raw = localStorage.getItem('aurora-chat-conversations')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
  })
})

describe('hasImportedLocalConversations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when not imported', () => {
    expect(hasImportedLocalConversations()).toBe(false)
  })

  it('returns true after marking imported', () => {
    markLocalConversationsImported()
    expect(hasImportedLocalConversations()).toBe(true)
  })
})
