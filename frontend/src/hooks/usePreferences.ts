import { useCallback, useEffect, useState } from 'react'
import {
  deleteUserMemory,
  fetchChatPreferences,
  fetchUserMemories,
  updateChatPreferences,
} from '../services/chat'
import type { ChatToneStyle, UserMemory, UserPreference } from '../types/chat'

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreference | null>(null)
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setStatus(null)
      const [nextPreferences, nextMemories] = await Promise.all([
        fetchChatPreferences(),
        fetchUserMemories(),
      ])
      setPreferences(nextPreferences)
      setMemories(nextMemories)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load preferences.')
    } finally {
      setLoading(false)
    }
  }, [])

  const savePreferences = useCallback(async () => {
    if (!preferences) return
    try {
      setSaving(true)
      const next = await updateChatPreferences(preferences)
      setPreferences(next)
      setStatus('Preferences saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save preferences.')
    } finally {
      setSaving(false)
    }
  }, [preferences])

  const removeMemory = useCallback(async (memoryId: string) => {
    try {
      await deleteUserMemory(memoryId)
      setMemories((current) => current.filter((item) => item.id !== memoryId))
      setStatus('Memory deleted.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete memory.')
    }
  }, [])

  const updatePreference = useCallback(<K extends keyof UserPreference>(key: K, value: UserPreference[K]) => {
    setPreferences((current) => current ? { ...current, [key]: value } : current)
  }, [])

  return {
    preferences,
    setPreferences,
    memories,
    loading,
    saving,
    status,
    setStatus,
    load,
    savePreferences,
    removeMemory,
    updatePreference,
  }
}

export const tones: Array<{ id: ChatToneStyle; labelKey: string }> = [
  { id: 'professional', labelKey: 'chat.professional' },
  { id: 'friendly', labelKey: 'chat.friendly' },
  { id: 'quirky', labelKey: 'chat.quirky' },
  { id: 'honest', labelKey: 'chat.honest' },
]
