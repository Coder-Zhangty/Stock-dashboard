import { clsx } from 'clsx'

export type Market = 'CN' | 'HK' | 'US'

const MARKETS: { key: Market; label: string }[] = [
  { key: 'CN', label: '沪深' },
  { key: 'HK', label: '港股' },
  { key: 'US', label: '美股' },
]

interface Props {
  current: Market
  onChange: (m: Market) => void
}

export default function MarketSwitcher({ current, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 bg-bg-primary rounded p-0.5">
      {MARKETS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={clsx(
            'px-2.5 py-1 rounded text-[11px] font-medium transition',
            current === key
              ? 'bg-accent-blue text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
