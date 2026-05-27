import { useCallback, useEffect, useState } from 'react'

import { fetchCatalog } from '../services/aiPlatform'
import { fetchWorkspaceSummary } from '../services/chat'
import { fetchLibraryItems, uploadLibraryFiles } from '../services/library'
import type { ProviderCatalog, UserPermissionPolicy, WorkspaceSummary } from '../types/chat'
import type { LibraryItem } from '../types/library'

const defaultPermissions: UserPermissionPolicy = {
  allowLibraryUpload: true,
  allowVoiceMode: true,
  allowWebSearch: true,
  allowDeepResearch: true,
  allowImageTools: true,
  allowAgentMode: true,
}

interface UseWorkspaceOptions {
  setConversationDefaults: (defaults: {
    selectedModelId?: string
    selectedProviderId?: string
    autoModelStrategy?: string | null
  }) => void
}

export function useWorkspace({ setConversationDefaults }: UseWorkspaceOptions) {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [catalog, setCatalog] = useState<ProviderCatalog | null>(null)
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null)

  const permissions = workspaceSummary?.permissions ?? catalog?.permissions ?? defaultPermissions

  const refreshWorkspace = useCallback(async () => {
    try {
      const [nextLibraryItems, nextCatalog, nextWorkspace] = await Promise.all([
        fetchLibraryItems('mine'),
        fetchCatalog(),
        fetchWorkspaceSummary(),
      ])
      setLibraryItems(nextLibraryItems)
      setCatalog(nextCatalog)
      setWorkspaceSummary(nextWorkspace)
      setConversationDefaults({
        selectedModelId: nextWorkspace.defaultModelId ?? nextCatalog.managedDefaultModel,
        selectedProviderId: nextCatalog.managedProviderId,
        autoModelStrategy: nextWorkspace.modeOptions[0]?.strategy ?? null,
      })
      return { catalog: nextCatalog, workspace: nextWorkspace }
    } catch {
      setLibraryItems([])
      setCatalog(null)
      setWorkspaceSummary(null)
      return null
    }
  }, [setConversationDefaults])

  useEffect(() => {
    void refreshWorkspace()
    const interval = window.setInterval(() => {
      void refreshWorkspace()
    }, 45000)
    const handleFocus = () => {
      void refreshWorkspace()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [refreshWorkspace])

  const handleUploadFiles = useCallback(async (files: File[]) => {
    const nextItems = await uploadLibraryFiles(files)
    setLibraryItems((current) => [...nextItems, ...current])
    return nextItems
  }, [])

  return {
    libraryItems,
    catalog,
    workspaceSummary,
    permissions,
    refreshWorkspace,
    handleUploadFiles,
  }
}
