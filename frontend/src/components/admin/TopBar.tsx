import { Search } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'
import { LanguageSwitcher } from '../common/LanguageSwitcher'

interface TopBarProps {
  title: string
  description: string
  searchValue: string
  onSearchChange: (value: string) => void
  action?: React.ReactNode
}

export const TopBar = ({ title, description, searchValue, onSearchChange, action }: TopBarProps) => {
  const { locale } = useI18n()
  const placeholder = locale === 'zh-CN' ? '搜索用户、模型、文件、日志' : 'Search users, models, files, logs'

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/90 px-8 py-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-ink">{title}</h1>
        <p className="mt-2 max-w-[840px] text-sm leading-7 text-muted">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            className="h-11 w-[280px] rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-slate-300"
          />
        </label>
        <LanguageSwitcher className="justify-center" />
        {action}
      </div>
    </div>
  )
}
