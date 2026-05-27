import type { LibraryItem } from '../types/library'
import { requestJson } from './api'
import { readStoredToken } from './auth'

interface LibraryItemDto {
  id: string
  owner_id: string | null
  name: string
  type: LibraryItem['type']
  kind: string
  source: 'upload' | 'generated'
  size_label: string
  created_at: string
}

const toLibraryItem = (item: LibraryItemDto): LibraryItem => ({
  id: item.id,
  ownerId: item.owner_id,
  name: item.name,
  type: item.type,
  kind: item.kind,
  source: item.source,
  sizeLabel: item.size_label,
  createdAt: item.created_at,
})

export const fetchLibraryItems = async (scope: 'mine' | 'all' = 'mine') => {
  const token = readStoredToken()
  const response = await requestJson<{ items: LibraryItemDto[] }>(
    `/api/library?scope=${scope}`,
    { token },
  )
  return response.items.map(toLibraryItem)
}

export const uploadLibraryFiles = async (files: FileList | File[]) => {
  const token = readStoredToken()
  const uploads = await Promise.all(
    Array.from(files).map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await requestJson<LibraryItemDto>('/api/library/upload', {
        method: 'POST',
        body: formData,
        token,
      })
      return toLibraryItem(response)
    }),
  )
  return uploads
}
