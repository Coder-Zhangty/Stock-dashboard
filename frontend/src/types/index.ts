export interface BidAskLevel {
  price: number
  volume: number
}

export interface StockQuote {
  code: string
  name: string
  market: string
  latest_price: number
  prev_close: number
  change_pct: number
  change_amount: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  turnover: number
  turnover_rate: number
  volume_ratio: number
  pe: number
  pe_ttm: number
  pb: number
  amplitude: number
  total_market_cap: number
  circulating_market_cap: number
  bids?: BidAskLevel[]
  asks?: BidAskLevel[]
}

export interface KLineItem {
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
  turnover_rate?: number
  ma5?: number
  ma10?: number
  ma20?: number
  ma60?: number
  dif?: number
  dea?: number
  macd?: number
  kdj_k?: number
  kdj_d?: number
  kdj_j?: number
  rsi6?: number
  rsi12?: number
  rsi24?: number
  boll_mid?: number
  boll_up?: number
  boll_low?: number
}

export interface NewsItem {
  id: number
  source: string
  title: string
  url: string
  content: string
  related_code: string
  sentiment: string
  published_at: string
}

export interface CyqData {
  prices: number[]
  chips: number[]
  latest_price: number
  profit_ratio: number
  avg_cost: number
  cost90_low: number
  cost90_high: number
  concentration90: number
  cost70_low: number
  cost70_high: number
  concentration70: number
}

export type ArticleViewMode = 'proxy' | 'extract' | 'direct'

export interface ExtractedArticle {
  title: string
  content: string
  source_url: string
}

export interface WatchlistItem {
  id: number
  code: string
  name: string
  market: string
  added_at: string
  notes: string
}

export interface StockSearchResult {
  code: string
  name: string
  market: string
}

export interface MinuteBar {
  time: string
  price: number
  avg_price: number
  volume: number
}

export interface MinuteData {
  data: MinuteBar[]
  prev_close: number
  code: string
  date?: string
}

export interface FundFlowItem {
  date: string
  main_net: number
  super_large: number
  large: number
  medium: number
  small: number
}

export interface StockBrief {
  code: string
  market_cap: number
  pe: number
  pb: number
  high_52w: number
  low_52w: number
  amplitude: number
  total_shares: number
  turnover: number
}

export interface FundFlowSummary {
  main_net: number
  super_large: number
  large: number
  medium: number
  small: number
}

export interface MarketContext {
  code: string
  name: string
  price: number
  prevClose: number
  changePct: number
  changeAmount: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  turnover: number
  marketCap?: number
  pe?: number
  pb?: number
  high52w?: number
  low52w?: number
  amplitude?: number
  fundFlow?: FundFlowSummary
}
