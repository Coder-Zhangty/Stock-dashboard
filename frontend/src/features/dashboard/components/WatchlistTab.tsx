import { Trash2 } from 'lucide-react'
import { useI18n } from '../../../i18n/I18nProvider'

interface WatchItem {
  code: string
  name: string
  market: string
}

interface WatchlistTabProps {
  watchlist: WatchItem[]
  loading: boolean
  quotes: Record<string, { latest_price: number; change_pct: number }>
  onSelect: (code: string) => void
  onRemove: (code: string) => void
}

export function WatchlistTab({ watchlist, loading, quotes, onSelect, onRemove }: WatchlistTabProps) {
  const { t } = useI18n()

  if (loading) {
    return <p className="text-text-secondary text-xs p-4">{t('dashboard.watchlist.loading')}</p>
  }

  if (watchlist.length === 0) {
    return <p className="text-text-secondary text-xs p-4">{t('dashboard.watchlist.empty')}</p>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
          <tr className="text-text-secondary">
            <th className="text-left py-2 px-3 font-medium">{t('dashboard.stocklist.code')}</th>
            <th className="text-left py-2 px-3 font-medium">{t('dashboard.stocklist.name')}</th>
            <th className="text-right py-2 px-3 font-medium">{t('dashboard.stocklist.price')}</th>
            <th className="text-right py-2 px-3 font-medium">{t('dashboard.stocklist.change')}</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {watchlist.map((item) => {
            const q = quotes[item.code]
            const pct = q?.change_pct ?? 0
            const isUp = pct >= 0
            const color = isUp ? 'text-up' : 'text-down'
            return (
              <tr
                key={item.code}
                className="border-b border-border-color/50 hover:bg-bg-card cursor-pointer"
                onClick={() => onSelect(item.code)}
              >
                <td className="py-2 px-3 text-text-secondary">{item.code}</td>
                <td className="py-2 px-3">{item.name}</td>
                <td className={`py-2 px-3 text-right ${color}`}>
                  {q ? q.latest_price.toFixed(2) : '--'}
                </td>
                <td className={`py-2 px-3 text-right ${color}`}>
                  {q ? `${isUp ? '+' : ''}${pct.toFixed(2)}%` : '--'}
                </td>
                <td className="py-2 px-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(item.code) }}
                    className="text-text-secondary hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
