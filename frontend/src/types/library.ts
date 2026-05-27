export interface LibraryItem {
  id: string
  ownerId?: string | null
  name: string
  type: 'pdf' | 'ppt' | 'csv' | 'doc' | 'image' | 'text' | 'code'
  kind: string
  sizeLabel: string
  createdAt: string
  source: 'upload' | 'generated'
}
