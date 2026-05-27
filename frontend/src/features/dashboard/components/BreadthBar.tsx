import { useI18n } from '../../../i18n/I18nProvider'

interface BreadthBarProps {
  breadth: { up: number; down: number; flat: number; total: number }
}

export function BreadthBar({ breadth }: BreadthBarProps) {
  const { t } = useI18n()
  if (breadth.total === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-0.5 border-b border-border-color bg-bg-secondary/50 text-[10px] text-text-secondary">
      <span>{t('dashboard.breadth.title')}</span>
      <span className="text-up font-medium">{breadth.up}↑</span>
      <span className="text-down font-medium">{breadth.down}↓</span>
      <span>{breadth.flat}{t('dashboard.breadth.flat')}</span>
      <div className="flex-1 h-1 rounded-full bg-bg-primary ml-2 overflow-hidden">
        <div className="flex h-full">
          <span className="bg-up h-full" style={{ width: `${(breadth.up / breadth.total) * 100}%` }} />
          <span className="bg-text-secondary/30 h-full" style={{ width: `${(breadth.flat / breadth.total) * 100}%` }} />
          <span className="bg-down h-full" style={{ width: `${(breadth.down / breadth.total) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
