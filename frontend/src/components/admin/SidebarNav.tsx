import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { LogOut } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'
import type { AdminSection } from '../../types/admin'
import type { AuthSession } from '../../types/auth'

interface NavItem {
  id: AdminSection
  label: string
  icon: LucideIcon
}

interface SidebarNavProps {
  items: NavItem[]
  activeSection: AdminSection
  session: AuthSession
  onSelect: (section: AdminSection) => void
  onLogout: () => void
}

export const SidebarNav = ({ items, activeSection, session, onSelect, onLogout }: SidebarNavProps) => {
  const { locale } = useI18n()
  return (
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#f6f8fb] px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111827] text-[12px] font-semibold tracking-[0.16em] text-white">
          AU
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink">Aurora</p>
          <p className="text-xs text-subtle">{locale === 'zh-CN' ? '管理后台' : 'Control Plane'}</p>
        </div>
      </div>

      <nav className="mt-7 flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-medium transition',
                activeSection === item.id
                  ? 'bg-white text-ink shadow-panel'
                  : 'text-muted hover:bg-white/80 hover:text-ink',
              )}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-4 rounded-[22px] border border-white bg-white/90 px-3 py-3 shadow-panel">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-sm font-semibold text-ink">
            {session.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{session.name}</p>
            <p className="truncate text-xs text-subtle">{session.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-subtle transition hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
