import type { MarketContextState } from '../../contexts/ChatContext'

interface Props {
  context: MarketContextState
}

export default function ContextIndicator({ context }: Props) {
  if (context.type === 'none') return null

  const isStock = context.type === 'stock'
  const colors = isStock
    ? 'bg-green-500/10 border-green-500/20 text-green-400'
    : 'bg-blue-500/10 border-blue-500/20 text-blue-400'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {context.label}
    </span>
  )
}
