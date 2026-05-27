import { FolderClosed, FolderOpen, Shield } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'
import type { LibraryScopeItem, LibraryScopeSelection } from './LibraryTable'

interface LibraryScopeTreeProps {
  scopes: LibraryScopeItem[]
  selectedScope: LibraryScopeSelection
  onSelectScope: (scope: LibraryScopeSelection) => void
}

export const LibraryScopeTree = ({
  scopes,
  selectedScope,
  onSelectScope,
}: LibraryScopeTreeProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'

  return (
    <aside className="rounded-[24px] border border-slate-200 bg-[#fbfcfe] p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{isZh ? '资料目录' : 'Library scopes'}</h3>
        <p className="mt-1 text-xs leading-6 text-muted">
          {isZh
            ? '按用户作为一级目录查看资料，管理员目录承载平台级系统资料。'
            : 'Browse files by user-owned scopes with a dedicated admin system scope.'}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {scopes.map((scope) => {
          const active =
            scope.type === selectedScope.type &&
            (scope.type === 'all' || scope.id === `${selectedScope.type}:${selectedScope.key}`)

          const Icon =
            scope.type === 'admin'
              ? Shield
              : active
                ? FolderOpen
                : FolderClosed

          return (
            <button
              key={scope.id}
              type="button"
              onClick={() =>
                onSelectScope(
                  scope.type === 'all'
                    ? { type: 'all', key: 'all' }
                    : { type: scope.type, key: scope.id.split(':')[1] ?? 'all' },
                )
              }
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
                  : 'border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                    active ? 'bg-white/12 text-white' : 'bg-slate-100 text-subtle'
                  }`}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${active ? 'text-white' : 'text-ink'}`}>
                    {scope.label}
                  </p>
                  {scope.sublabel ? (
                    <p className={`mt-1 truncate text-xs ${active ? 'text-slate-300' : 'text-subtle'}`}>
                      {scope.sublabel}
                    </p>
                  ) : null}
                </div>
              </div>

              <span
                className={`inline-flex min-w-[30px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                  active ? 'bg-white/12 text-white' : 'bg-slate-100 text-subtle'
                }`}
              >
                {scope.count}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
