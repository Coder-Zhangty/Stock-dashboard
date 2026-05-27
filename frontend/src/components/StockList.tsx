import type { StockQuote } from '../types'
import { Plus } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { SkeletonTable } from './common/Skeleton'

interface Props {
  data: StockQuote[]
  loading: boolean
  loadingMore?: boolean
  onSelect: (code: string) => void
  onAddWatchlist?: (code: string, name: string, market: string) => void
  sortBy: string
  sortOrder: string
  onSort: (column: string) => void
}

const fmtNum = (n: number, decimals = 2) => {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'
  return n.toFixed(decimals)
}

const SortArrow = ({ column, current }: { column: string; current: { by: string; order: string } }) => {
  if (current.by !== column) return <span className="text-text-secondary/30 ml-0.5">⇅</span>
  return <span className="text-accent-blue ml-0.5">{current.order === 'desc' ? '▼' : '▲'}</span>
}

export default function StockList({ data, loading, loadingMore, onSelect, onAddWatchlist, sortBy, sortOrder, onSort }: Props) {
  const { t } = useI18n()

  const COLUMNS: { key: string; label: string; align: 'left' | 'right' }[] = [
    { key: 'code', label: t('dashboard.stocklist.code'), align: 'left' },
    { key: 'name', label: t('dashboard.stocklist.name'), align: 'left' },
    { key: 'latest_price', label: t('dashboard.stocklist.price'), align: 'right' },
    { key: 'change_pct', label: t('dashboard.stocklist.change'), align: 'right' },
    { key: 'volume', label: t('dashboard.stocklist.volume'), align: 'right' },
    { key: 'amount', label: t('dashboard.stocklist.amount'), align: 'right' },
    { key: 'turnover', label: t('dashboard.stocklist.turnover'), align: 'right' },
    { key: 'volume_ratio', label: t('dashboard.stocklist.volumeRatio'), align: 'right' },
    { key: 'pe', label: t('dashboard.stocklist.pe'), align: 'right' },
    { key: 'pb', label: t('dashboard.stocklist.pb'), align: 'right' },
    { key: 'amplitude', label: t('dashboard.stocklist.amplitude'), align: 'right' },
    { key: 'total_market_cap', label: t('dashboard.stocklist.marketCap'), align: 'right' },
  ]

  if (loading) {
    return <SkeletonTable rows={12} cols={COLUMNS.length} />
  }

  const current = { by: sortBy, order: sortOrder }

  return (
    <div>
      <table className="text-xs" style={{ minWidth: 650 }}>
        <thead className="sticky top-0 bg-bg-secondary border-b border-border-color z-10">
          <tr className="text-text-secondary">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 font-medium cursor-pointer select-none hover:text-text-primary transition-colors whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                } ${sortBy === col.key ? 'text-text-primary' : ''}`}
                onClick={() => onSort(col.key)}
              >
                {col.label}
                <SortArrow column={col.key} current={current} />
              </th>
            ))}
            {onAddWatchlist && <th className="py-2 px-1 w-6" />}
          </tr>
        </thead>
        <tbody>
          {data.map((stock) => {
            const isUp = (stock.change_pct ?? 0) >= 0
            const color = isUp ? 'text-up' : 'text-down'
            return (
              <tr
                key={stock.code}
                className="border-b border-border-color/50 hover:bg-bg-card cursor-pointer transition-colors"
                onClick={() => onSelect(stock.code)}
              >
                <td className="py-2 px-3 text-text-secondary whitespace-nowrap">{stock.code}</td>
                <td className="py-2 px-3 whitespace-nowrap">{stock.name}</td>
                <td className={`py-2 px-3 text-right whitespace-nowrap ${color}`}>{(stock.latest_price ?? 0).toFixed(2)}</td>
                <td className={`py-2 px-3 text-right whitespace-nowrap ${color}`}>
                  {isUp ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">{fmtNum(stock.volume ?? 0)}</td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">{fmtNum(stock.amount ?? 0)}</td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.turnover ?? 0) > 0 ? `${stock.turnover.toFixed(2)}%` : '--'}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.volume_ratio ?? 0) > 0 ? stock.volume_ratio.toFixed(2) : '--'}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.pe ?? 0) > 0 ? stock.pe.toFixed(2) : '--'}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.pb ?? 0) > 0 ? stock.pb.toFixed(2) : '--'}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.amplitude ?? 0) > 0 ? `${stock.amplitude.toFixed(2)}%` : '--'}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary whitespace-nowrap">
                  {(stock.total_market_cap ?? 0) > 0 ? fmtNum(stock.total_market_cap) : '--'}
                </td>
                {onAddWatchlist && (
                  <td className="py-2 px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddWatchlist(stock.code, stock.name, stock.market) }}
                      className="text-text-secondary hover:text-accent-blue p-0.5"
                      title={t('dashboard.watchlist.addTitle')}
                    >
                      <Plus size={12} />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {loadingMore && (
        <div className="text-text-secondary text-[10px] text-center py-2">{t('dashboard.market.loadingMore')}</div>
      )}
    </div>
  )
}
