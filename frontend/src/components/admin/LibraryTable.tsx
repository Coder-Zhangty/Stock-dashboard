import { Eye, MoreHorizontal, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { LibraryRecord } from '../../types/admin'
import { StatusBadge } from './StatusBadge'
import { LibraryScopeTree } from './LibraryScopeTree'

export interface LibraryListFilters {
  typeFilter: 'all' | 'document' | 'image' | 'data'
  statusFilter: 'all' | LibraryRecord['status']
  ownerFilter: string
}

export interface LibraryScopeSelection {
  type: 'all' | 'admin' | 'user'
  key: string
}

export interface LibraryScopeItem {
  id: string
  label: string
  sublabel?: string
  type: 'all' | 'admin' | 'user'
  count: number
}

interface LibraryTableProps {
  items: LibraryRecord[]
  searchValue: string
  filters: LibraryListFilters
  selectedScope: LibraryScopeSelection
  selectedFileId: string | null
  onFiltersChange: (patch: Partial<LibraryListFilters>) => void
  onSelectScope: (scope: LibraryScopeSelection) => void
  onSelectFile: (fileId: string) => void
  onPreviewFile: (item: LibraryRecord) => void
  onReindexFile: (item: LibraryRecord) => void
  onDeleteFile: (item: LibraryRecord) => void
}

const statusTone = (status: LibraryRecord['status']) => {
  if (status === 'indexed') return 'success'
  if (status === 'processing' || status === 'pending') return 'warning'
  if (status === 'deleted') return 'default'
  return 'danger'
}

const statusLabel = (status: LibraryRecord['status'], isZh: boolean) =>
  isZh
    ? {
        pending: '待处理',
        processing: '索引中',
        indexed: '已索引',
        error: '索引失败',
        deleted: '已删除',
      }[status]
    : {
        pending: 'Pending',
        processing: 'Processing',
        indexed: 'Indexed',
        error: 'Error',
        deleted: 'Deleted',
      }[status]

const kindLabel = (kind: string, isZh: boolean) => {
  if (!isZh) return kind
  return (
    {
      document: '文档',
      image: '图像',
      data: '数据',
    }[kind as 'document' | 'image' | 'data'] ?? kind
  )
}

const normalizeSourceLabel = (source: string, isZh: boolean) => {
  const mapping = {
    user_upload: isZh ? '用户上传' : 'User upload',
    admin_upload: isZh ? '管理员导入' : 'Admin import',
    import: isZh ? '导入' : 'Import',
    upload: isZh ? '上传' : 'Upload',
    'ç”¨æˆ·ä¸Šä¼ ': isZh ? '用户上传' : 'User upload',
    'ç®¡ç†å‘˜å¯¼å…¥': isZh ? '管理员导入' : 'Admin import',
    'å¯¼å…¥': isZh ? '导入' : 'Import',
  } as const

  return mapping[source as keyof typeof mapping] ?? source
}

const deriveScope = (item: LibraryRecord, isZh: boolean) => {
  const source = normalizeSourceLabel(item.source, isZh)
  const isSystemMaterial =
    item.isSystemMaterial === true ||
    item.scopeType === 'admin' ||
    item.ownerRole === 'admin' ||
    item.ownerRole === 'system' ||
    source === (isZh ? '管理员导入' : 'Admin import') ||
    source === (isZh ? '导入' : 'Import') ||
    !item.ownerId

  if (isSystemMaterial) {
    return {
      type: 'admin' as const,
      key: 'admin-system',
      label: isZh ? '管理员 / 系统资料' : 'Admin / System materials',
      sublabel: isZh ? '平台级资料与系统导入文件' : 'Platform materials and system imports',
    }
  }

  return {
    type: 'user' as const,
    key: item.ownerId ?? item.ownerEmail ?? item.id,
    label: item.ownerName || (isZh ? '未知用户' : 'Unknown user'),
    sublabel: item.ownerEmail || undefined,
  }
}

export const LibraryTable = ({
  items,
  searchValue,
  filters,
  selectedScope,
  selectedFileId,
  onFiltersChange,
  onSelectScope,
  onSelectFile,
  onPreviewFile,
  onReindexFile,
  onDeleteFile,
}: LibraryTableProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'

  const scopes = useMemo(() => {
    const map = new Map<string, LibraryScopeItem>()

    items.forEach((item) => {
      const scope = deriveScope(item, isZh)
      const id = `${scope.type}:${scope.key}`
      const current = map.get(id)
      map.set(id, {
        id,
        label: scope.label,
        sublabel: scope.sublabel,
        type: scope.type,
        count: (current?.count ?? 0) + 1,
      })
    })

    return [
      {
        id: 'all:all',
        label: isZh ? '全部资料' : 'All materials',
        sublabel: isZh ? '查看所有目录中的文件' : 'Browse every file across scopes',
        type: 'all' as const,
        count: items.length,
      },
      ...[...map.values()].sort((left, right) => {
        if (left.type === 'admin' && right.type !== 'admin') return -1
        if (left.type !== 'admin' && right.type === 'admin') return 1
        return left.label.localeCompare(right.label)
      }),
    ]
  }, [isZh, items])

  const owners = useMemo(
    () => Array.from(new Set(items.map((item) => item.ownerEmail).filter(Boolean))),
    [items],
  )

  const scopedItems = useMemo(() => {
    if (selectedScope.type === 'all') return items

    return items.filter((item) => {
      const scope = deriveScope(item, isZh)
      return scope.type === selectedScope.type && scope.key === selectedScope.key
    })
  }, [isZh, items, selectedScope])

  const filteredItems = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return scopedItems.filter((item) => {
      if (
        keyword &&
        ![
          item.name,
          item.ownerName,
          item.ownerEmail,
          item.type,
          item.kind,
          item.source,
          item.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false
      }
      if (filters.typeFilter !== 'all' && item.kind !== filters.typeFilter) return false
      if (filters.statusFilter !== 'all' && item.status !== filters.statusFilter) return false
      if (filters.ownerFilter !== 'all' && item.ownerEmail !== filters.ownerFilter) return false
      return true
    })
  }, [filters, scopedItems, searchValue])

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{isZh ? '资料库' : 'Library'}</h2>
          <p className="mt-1 text-sm text-muted">
            {isZh
              ? '按目录、状态、归属和引用关系查看文件，并进入完整详情页继续处理。'
              : 'Inspect files by scope, status, ownership, and references, then open full detail views.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-muted">
          <Search size={14} />
          <span>{filteredItems.length}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <LibraryScopeTree
          scopes={scopes}
          selectedScope={selectedScope}
          onSelectScope={onSelectScope}
        />

        <div className="min-w-0">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                {isZh ? '文件类型' : 'File type'}
              </span>
              <select
                value={filters.typeFilter}
                onChange={(event) =>
                  onFiltersChange({ typeFilter: event.target.value as LibraryListFilters['typeFilter'] })
                }
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="all">{isZh ? '全部类型' : 'All types'}</option>
                <option value="document">{isZh ? '文档' : 'Document'}</option>
                <option value="image">{isZh ? '图像' : 'Image'}</option>
                <option value="data">{isZh ? '数据' : 'Data'}</option>
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                {isZh ? '状态' : 'Status'}
              </span>
              <select
                value={filters.statusFilter}
                onChange={(event) =>
                  onFiltersChange({ statusFilter: event.target.value as LibraryListFilters['statusFilter'] })
                }
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="all">{isZh ? '全部状态' : 'All states'}</option>
                <option value="pending">{isZh ? '待处理' : 'Pending'}</option>
                <option value="processing">{isZh ? '索引中' : 'Processing'}</option>
                <option value="indexed">{isZh ? '已索引' : 'Indexed'}</option>
                <option value="error">{isZh ? '索引失败' : 'Error'}</option>
                <option value="deleted">{isZh ? '已删除' : 'Deleted'}</option>
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                {isZh ? '归属用户' : 'Owner'}
              </span>
              <select
                value={filters.ownerFilter}
                onChange={(event) => onFiltersChange({ ownerFilter: event.target.value })}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="all">{isZh ? '全部用户' : 'All users'}</option>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
            <div className="grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.7fr)_120px_100px_140px_128px] gap-4 bg-[#f8f9fb] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
              <span>{isZh ? '文件' : 'File'}</span>
              <span>{isZh ? '上传者' : 'Owner'}</span>
              <span>{isZh ? '状态' : 'Status'}</span>
              <span>{isZh ? '引用次数' : 'Refs'}</span>
              <span>{isZh ? '上传时间' : 'Uploaded'}</span>
              <span className="text-right">{isZh ? '操作' : 'Actions'}</span>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted">
                  {isZh ? '当前目录和筛选条件下没有文件记录。' : 'No files match the current scope and filters.'}
                </div>
              ) : null}

              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.7fr)_120px_100px_140px_128px] gap-4 px-5 py-4 text-sm transition hover:bg-[#fafbfd] ${
                    selectedFileId === item.id ? 'bg-[#f8fbff]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectFile(item.id)}
                    className="min-w-0 text-left"
                    title={item.name}
                  >
                    <p className="truncate font-medium text-ink">{item.name}</p>
                    <p className="mt-1 truncate text-xs text-subtle">
                      {kindLabel(item.kind, isZh)} · {item.type} · {item.sizeLabel} ·{' '}
                      {normalizeSourceLabel(item.source, isZh)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectFile(item.id)}
                    className="min-w-0 text-left"
                    title={`${item.ownerName} · ${item.ownerEmail}`}
                  >
                    <p className="truncate font-medium text-ink">{item.ownerName}</p>
                    <p className="mt-1 truncate text-xs text-subtle">{item.ownerEmail}</p>
                  </button>

                  <div className="flex items-center">
                    <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isZh)}</StatusBadge>
                  </div>

                  <div className="text-muted">
                    <p className="font-medium text-ink">{item.referencedBy}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {item.lastReferencedAt
                        ? new Date(item.lastReferencedAt).toLocaleDateString()
                        : isZh
                          ? '暂无引用'
                          : 'No refs'}
                    </p>
                  </div>

                  <div className="text-xs leading-5 text-subtle">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onPreviewFile(item)}
                      className="rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
                      title={isZh ? '查看详情' : 'View detail'}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReindexFile(item)}
                      className="rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
                      title={isZh ? '重新索引' : 'Reindex'}
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFile(item)}
                      className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50"
                      title={isZh ? '删除文件' : 'Delete file'}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectFile(item.id)}
                      className="rounded-xl p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
                      title={isZh ? '更多详情' : 'More detail'}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
