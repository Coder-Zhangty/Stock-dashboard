import {
  MoreHorizontal,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { useLayoutMode } from '../../hooks/useLayoutMode'
import { useI18n } from '../../i18n/I18nProvider'
import type { AdminSection } from '../../types/admin'
import type { AuthSession } from '../../types/auth'
import { LanguageSwitcher } from '../common/LanguageSwitcher'
import { LayoutModeSwitcher } from '../common/LayoutModeSwitcher'
import { MobileSheet } from '../common/MobileSheet'
import { SidebarNav } from './SidebarNav'
import { TopBar } from './TopBar'

interface NavItem {
  id: AdminSection
  label: string
  icon: LucideIcon
}

interface AdminLayoutProps {
  navItems: NavItem[]
  activeSection: AdminSection
  session: AuthSession
  title: string
  description: string
  searchValue: string
  onSearchChange: (value: string) => void
  onSectionChange: (section: AdminSection) => void
  onLogout: () => void
  action?: ReactNode
  children: ReactNode
}

const primarySections: AdminSection[] = ['overview', 'users', 'models', 'library']

export const AdminLayout = ({
  navItems,
  activeSection,
  session,
  title,
  description,
  searchValue,
  onSearchChange,
  onSectionChange,
  onLogout,
  action,
  children,
}: AdminLayoutProps) => {
  const { preference, resolvedMode, setPreference } = useLayoutMode('admin')
  const { locale } = useI18n()
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const placeholder =
    locale === 'zh-CN'
      ? '搜索用户、模型、文件、日志'
      : locale === 'ja-JP'
        ? 'ユーザー、モデル、ファイル、ログを検索'
        : locale === 'es-ES'
          ? 'Buscar usuarios, modelos, archivos y registros'
          : 'Search users, models, files, logs'
  const moreLabel =
    locale === 'zh-CN' ? '更多' : locale === 'ja-JP' ? 'その他' : locale === 'es-ES' ? 'Más' : 'More'
  const logoutLabel =
    locale === 'zh-CN' ? '退出登录' : locale === 'ja-JP' ? 'ログアウト' : locale === 'es-ES' ? 'Cerrar sesión' : 'Log out'

  if (resolvedMode === 'desktop') {
    return (
      <main className="flex h-screen overflow-hidden bg-[#f8f9fb] text-ink">
        <SidebarNav
          items={navItems}
          activeSection={activeSection}
          session={session}
          onSelect={onSectionChange}
          onLogout={onLogout}
        />
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            title={title}
            description={description}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            action={action}
          />
          <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
        </section>
      </main>
    )
  }

  const primaryNav = navItems.filter((item) => primarySections.includes(item.id))
  const moreNav = navItems.filter((item) => !primarySections.includes(item.id))

  return (
    <main className="mobile-shell-bg flex h-screen flex-col overflow-hidden text-ink md:hidden">
      <header className="border-b border-slate-200/70 bg-white/82 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.05em] text-ink">{title}</h1>
            <p className="mt-1 text-[12px] leading-5 text-muted">{description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((current) => !current)}
              className="mobile-toolbar-button flex h-10 w-10 items-center justify-center rounded-full text-subtle"
            >
              <Search size={16} />
            </button>
            <div className="rounded-full border border-slate-200/70 bg-white/78 px-1 py-1 shadow-sm backdrop-blur-md">
              <LanguageSwitcher compact className="border-0 bg-transparent shadow-none" />
            </div>
          </div>
        </div>

        {searchOpen ? (
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={placeholder}
              className="h-11 w-full rounded-full border border-slate-200 bg-white/88 pl-10 pr-4 text-sm outline-none transition focus:border-slate-300"
            />
          </label>
        ) : null}

        <div className="mt-3 flex flex-col gap-3">
          <LayoutModeSwitcher value={preference} onChange={setPreference} compact />
          {action ? <div className="overflow-x-auto pb-1">{action}</div> : null}
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+86px)]">
        {children}
      </section>

      <nav className="mobile-bottom-dock fixed inset-x-0 bottom-0 z-30 px-3 py-2">
        <div className="grid grid-cols-5 gap-2">
          {primaryNav.map((item) => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex flex-col items-center justify-center rounded-[18px] px-2 py-2 text-[11px] font-medium transition ${
                  active
                    ? 'bg-[#171c27] text-white shadow-[0_12px_22px_rgba(15,23,42,0.14)]'
                    : 'text-subtle hover:bg-white/70 hover:text-ink'
                }`}
              >
                <Icon size={16} />
                <span className="mt-1">{item.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center rounded-[18px] px-2 py-2 text-[11px] font-medium transition ${
              moreOpen || moreNav.some((item) => item.id === activeSection)
                ? 'bg-[#171c27] text-white shadow-[0_12px_22px_rgba(15,23,42,0.14)]'
                : 'text-subtle hover:bg-white/70 hover:text-ink'
            }`}
          >
            <MoreHorizontal size={16} />
            <span className="mt-1">{moreLabel}</span>
          </button>
        </div>
      </nav>

      <MobileSheet open={moreOpen} title={moreLabel} onClose={() => setMoreOpen(false)}>
        <div className="space-y-3">
          {moreNav.map((item) => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSectionChange(item.id)
                  setMoreOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-[22px] border px-4 py-3.5 text-left transition ${
                  active
                    ? 'border-black/8 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)]'
                    : 'border-black/5 bg-white/84'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-subtle">
                  <Icon size={16} />
                </div>
                <span className="text-[14px] font-medium text-ink">{item.label}</span>
              </button>
            )
          })}

          <div className="mobile-soft-panel rounded-[24px] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-[12px] font-semibold text-white">
                {session.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{session.name}</p>
                <p className="truncate text-[12px] text-subtle">{session.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 flex w-full items-center justify-center rounded-[18px] border border-black/7 bg-slate-950 px-4 py-3 text-[14px] font-medium text-white"
            >
              {logoutLabel}
            </button>
          </div>
        </div>
      </MobileSheet>
    </main>
  )
}
