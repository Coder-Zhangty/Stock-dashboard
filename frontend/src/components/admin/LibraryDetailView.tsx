import { AlertTriangle, ArrowLeft, Eye, RefreshCw, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { LibraryRecord } from '../../types/admin'
import { StatusBadge } from './StatusBadge'

interface LibraryDetailViewProps {
  item: LibraryRecord | null
  onBack: () => void
  onPreview: (item: LibraryRecord) => void
  onReindex: (item: LibraryRecord) => void
  onMarkAbnormal: (item: LibraryRecord) => void
  onDelete: (item: LibraryRecord) => void
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

const deriveScopeLabel = (item: LibraryRecord, isZh: boolean) => {
  if (item.scopeType === 'admin' || item.isSystemMaterial || item.ownerRole === 'admin' || item.ownerRole === 'system') {
    return isZh ? '管理员 / 系统资料' : 'Admin / System materials'
  }

  return item.scopeLabel || item.ownerName
}

const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) => (
  <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-panel">
    <div>
      <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
    <p className="mt-2 break-words text-base font-semibold tracking-[-0.02em] text-ink">{value}</p>
  </div>
)

export const LibraryDetailView = ({
  item,
  onBack,
  onPreview,
  onReindex,
  onMarkAbnormal,
  onDelete,
}: LibraryDetailViewProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'

  if (!item) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-muted">
        {isZh
          ? '没有找到这个文件，请返回资料库概览页重新选择。'
          : 'The file could not be found. Return to the library overview and select again.'}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-muted transition hover:border-slate-300 hover:text-ink"
        >
          <ArrowLeft size={15} />
          {isZh ? '返回资料库概览' : 'Back to library'}
        </button>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-[30px] font-semibold tracking-[-0.04em] text-ink">{item.name}</h2>
              <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isZh)}</StatusBadge>
            </div>
            <p className="mt-2 break-words text-sm text-muted">
              {item.ownerName} · {item.ownerEmail}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-subtle">{deriveScopeLabel(item, isZh)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPreview(item)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-50"
            >
              <Eye size={15} />
              {isZh ? '预览' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => onReindex(item)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              {isZh ? '重新索引' : 'Reindex'}
            </button>
            <button
              type="button"
              onClick={() => onMarkAbnormal(item)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <AlertTriangle size={15} />
              {isZh ? '标记异常' : 'Mark abnormal'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={15} />
              {isZh ? '删除文件' : 'Delete'}
            </button>
          </div>
        </div>
      </section>

      <Section
        title={isZh ? '基本信息' : 'Basic information'}
        description={
          isZh
            ? '查看文件格式、大小、来源、上传者和所属目录。'
            : 'Inspect format, size, source, owner, and scope details.'
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label={isZh ? '文件类型' : 'Type'} value={item.type} />
          <Stat label={isZh ? '文件大小' : 'Size'} value={item.sizeLabel} />
          <Stat label={isZh ? '上传时间' : 'Uploaded'} value={new Date(item.createdAt).toLocaleString()} />
          <Stat label={isZh ? '来源' : 'Source'} value={normalizeSourceLabel(item.source, isZh)} />
          <Stat label={isZh ? '所属目录' : 'Scope'} value={deriveScopeLabel(item, isZh)} />
          <Stat label={isZh ? '上传者' : 'Owner'} value={item.ownerName} />
          <Stat label={isZh ? '邮箱' : 'Email'} value={item.ownerEmail} />
        </div>
      </Section>

      <Section
        title={isZh ? '状态与索引' : 'Status and indexing'}
        description={
          isZh
            ? '跟踪索引状态、最近引用时间和文件当前可用性。'
            : 'Track indexing state, latest reference time, and file availability.'
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label={isZh ? '当前状态' : 'Current status'} value={statusLabel(item.status, isZh)} />
          <Stat label={isZh ? '引用次数' : 'Reference count'} value={String(item.referencedBy)} />
          <Stat
            label={isZh ? '最近引用' : 'Last referenced'}
            value={
              item.lastReferencedAt
                ? new Date(item.lastReferencedAt).toLocaleString()
                : isZh
                  ? '暂无引用'
                  : 'No references'
            }
          />
          <Stat label={isZh ? '引用会话数' : 'Conversation refs'} value={String(item.referencedConversations.length)} />
        </div>
      </Section>

      <Section
        title={isZh ? '引用关系' : 'References'}
        description={
          isZh ? '查看当前哪些会话仍在引用这个文件。' : 'See which conversations currently reference this file.'
        }
      >
        <div className="space-y-2">
          {item.referencedConversations.length ? (
            item.referencedConversations.map((conversationId) => (
              <div
                key={conversationId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                <span className="min-w-0 break-all text-ink">{conversationId}</span>
                <StatusBadge tone="default">{isZh ? '会话引用' : 'Conversation ref'}</StatusBadge>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-muted">
              {isZh ? '当前没有会话引用这个文件。' : 'No conversations reference this file yet.'}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
