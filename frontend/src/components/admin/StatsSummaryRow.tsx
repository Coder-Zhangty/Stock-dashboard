import clsx from 'clsx'

import { useI18n } from '../../i18n/I18nProvider'
import type { OverviewMetricCard } from '../../types/admin'

interface StatsSummaryRowProps {
  cards: OverviewMetricCard[]
  onCardClick?: (card: OverviewMetricCard) => void
  refreshing?: boolean
}

export const StatsSummaryRow = ({ cards, onCardClick, refreshing = false }: StatsSummaryRowProps) => {
  const { locale } = useI18n()

  return (
    <div className="grid w-full gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onCardClick?.(card)}
          disabled={refreshing}
          className={clsx(
            'rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-panel transition hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]',
            refreshing && 'pointer-events-none opacity-75',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              {locale === 'zh-CN' ? card.label : card.label}
            </p>
            <span
              className={clsx(
                'text-xs font-medium',
                card.tone === 'success' && 'text-emerald-600',
                card.tone === 'warning' && 'text-amber-600',
                !card.tone && 'text-slate-500',
              )}
            >
              {card.change}
            </span>
          </div>
          {refreshing ? (
            <div className="mt-4 h-10 w-24 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-ink">{card.value}</p>
          )}
        </button>
      ))}
    </div>
  )
}
