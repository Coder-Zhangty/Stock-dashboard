export const CHART_COLORS = {
  bg: '#16161c',
  bgSecondary: '#1a1a20',
  text: '#6b6b78',
  textSecondary: '#8b8b96',
  grid: '#22222b',
  border: '#2a2a33',
  up: '#ef4444',
  down: '#22c55e',
  upTransparent: '#ef444488',
  downTransparent: '#22c55e88',
  gold: '#fbbf24',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  pink: '#f472b6',
  amber: '#f59e0b',
  rose: '#fb7185',
  white: '#ffffff',
} as const

export const MA_DEFS = [
  { key: 'ma5' as const, label: 'MA5', color: CHART_COLORS.gold },
  { key: 'ma10' as const, label: 'MA10', color: CHART_COLORS.purple },
  { key: 'ma20' as const, label: 'MA20', color: CHART_COLORS.cyan },
  { key: 'ma60' as const, label: 'MA60', color: CHART_COLORS.pink },
]

export const BOLL_COLORS = {
  up: CHART_COLORS.upTransparent,
  mid: CHART_COLORS.amber,
  low: CHART_COLORS.downTransparent,
}

export const KDJ_COLORS = [CHART_COLORS.gold, CHART_COLORS.purple, CHART_COLORS.rose]

export const RSI_COLORS: Record<string, string> = {
  rsi6: CHART_COLORS.gold,
  rsi12: CHART_COLORS.purple,
  rsi24: CHART_COLORS.cyan,
}
