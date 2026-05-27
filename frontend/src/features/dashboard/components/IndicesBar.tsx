import { useI18n } from '../../../i18n/I18nProvider'

interface IndicesBarProps {
  indices: Array<{
    code: string
    name: string
    latest_price: number
    change_pct: number
  }>
}

export function IndicesBar({ indices }: IndicesBarProps) {
  const { t } = useI18n()

  return (
    <div className="dashboard-indices-bar flex items-center gap-4 px-3 py-1.5 border-b border-border-color bg-bg-secondary overflow-x-auto">
      {indices.map((idx) => {
        const up = idx.change_pct >= 0
        const c = up ? 'text-up' : 'text-down'
        return (
          <div key={idx.code} className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="text-text-secondary">{idx.name}</span>
            <span className="font-medium">{idx.latest_price.toFixed(2)}</span>
            <span className={c}>
              {up ? '+' : ''}{idx.change_pct.toFixed(2)}%
            </span>
          </div>
        )
      })}
      {indices.length === 0 && (
        <span className="text-text-secondary text-[10px]">{t('dashboard.indices.loading')}</span>
      )}
    </div>
  )
}
