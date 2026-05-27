import { useStockQuote, useKLine, useStockBrief, useStockSentiment, useMinuteLine, useFundFlow, useCyqData, useHKQuote, useHKKLine, useUSQuote, useUSKLine } from '../../hooks/useMarket'
import KLineChart, { type SubIndicator } from '../../components/KLineChart'
import MinuteChart from '../../components/MinuteChart'
import AIDecisionPanel from './components/AIDecisionPanel'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { MarketContext, StockQuote, FundFlowItem } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'
import { useChatContext } from '../../contexts/ChatContext'
import { CHART_COLORS } from '../../lib/chartTheme'
import { SkeletonQuote, SkeletonChart } from '../../components/common/Skeleton'

function detectMarket(code: string): 'CN' | 'HK' | 'US' {
  if (/^[A-Z]{1,5}$/.test(code)) return 'US'
  if (/^\d{5}$/.test(code) && code.startsWith('0')) return 'HK'
  return 'CN'
}

interface Props {
  code: string
  onBack: () => void
  onChatWithAI?: (ctx: MarketContext) => void
}

const PERIODS = (t: (k: string) => string): { key: string; label: string }[] => [
  { key: '5min', label: t('stockdetail.period.5min') },
  { key: '15min', label: t('stockdetail.period.15min') },
  { key: '30min', label: t('stockdetail.period.30min') },
  { key: '60min', label: t('stockdetail.period.60min') },
  { key: 'daily', label: t('stockdetail.period.daily') },
  { key: 'weekly', label: t('stockdetail.period.weekly') },
  { key: 'monthly', label: t('stockdetail.period.monthly') },
]

const fmtVol = (n: number) => {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿手'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万手'
  return n.toFixed(0)
}

const fmtAmt = (n: number) => {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(0) + '万'
  return n.toFixed(0)
}

function FundFlowChart({ data }: { data: FundFlowItem[] }) {
  const { t } = useI18n()
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.main_net)), 1)
  const totalNet = data.reduce((sum, d) => sum + d.main_net, 0)

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[10px]">
        <span className="text-text-secondary">{t('stockdetail.fundflow.netInflow')}:</span>
        <span className={`font-medium ${totalNet >= 0 ? 'text-up' : 'text-down'}`}>
          {totalNet >= 0 ? '+' : ''}{fmtAmt(totalNet)}
        </span>
      </div>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {data.map((item) => {
          const isBuy = item.main_net >= 0
          const barColor = isBuy ? CHART_COLORS.up : CHART_COLORS.down
          const w = (Math.abs(item.main_net) / maxAbs) * 100
          return (
            <div key={item.date} className="flex items-center gap-1.5 text-[10px]">
              <span className="text-text-secondary w-16 shrink-0">{item.date.slice(5)}</span>
              <span className={`w-18 text-right shrink-0 font-mono ${isBuy ? 'text-up' : 'text-down'}`}>
                {isBuy ? '+' : ''}{item.main_net.toFixed(0)}
              </span>
              <div className="flex-1 h-3 bg-bg-primary rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${w}%`,
                    backgroundColor: barColor,
                    opacity: 0.5 + (Math.abs(item.main_net) / maxAbs) * 0.5,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DepthPanel({ quote }: { quote: StockQuote }) {
  const { t } = useI18n()
  const asks = quote.asks || []
  const bids = quote.bids || []
  const maxVol = Math.max(...asks.map((a) => a.volume), ...bids.map((b) => b.volume), 1)
  const askRows = [...asks].reverse()

  return (
    <div className="text-[11px]">
      {askRows.map((level, i) => {
        const idx = asks.length - i
        return (
          <div key={`ask-${idx}`} className="flex items-center gap-1.5 py-0.5">
            <span className="text-text-secondary w-7 text-right shrink-0">{t('stockdetail.depth.sell')}{idx}</span>
            <span className="text-down w-16 text-right font-mono shrink-0">{level.price.toFixed(2)}</span>
            <span className="text-text-secondary w-12 text-right font-mono shrink-0">{level.volume}</span>
            <div className="flex-1 h-3 bg-down/10 rounded-sm overflow-hidden">
              <div
                className="h-full bg-down/30 rounded-sm ml-auto"
                style={{ width: `${(level.volume / maxVol) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-1.5 py-1 border-y border-border-color/50 my-0.5">
        <span className={`font-mono font-bold text-sm ${(quote.change_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
          {quote.latest_price.toFixed(2)}
        </span>
        <span className="text-text-secondary text-[10px]">{t('stockdetail.quote.price')}</span>
      </div>
      {bids.map((level, i) => {
        const idx = i + 1
        return (
          <div key={`bid-${idx}`} className="flex items-center gap-1.5 py-0.5">
            <span className="text-text-secondary w-7 text-right shrink-0">{t('stockdetail.depth.buy')}{idx}</span>
            <span className="text-up w-16 text-right font-mono shrink-0">{level.price.toFixed(2)}</span>
            <span className="text-text-secondary w-12 text-right font-mono shrink-0">{level.volume}</span>
            <div className="flex-1 h-3 bg-up/10 rounded-sm overflow-hidden">
              <div
                className="h-full bg-up/30 rounded-sm"
                style={{ width: `${(level.volume / maxVol) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
      {bids.length === 0 && asks.length === 0 && (
        <p className="text-text-secondary text-[10px] py-2">{t('stockdetail.depth.noData')}</p>
      )}
    </div>
  )
}

export default function StockDetail({ code, onBack, onChatWithAI }: Props) {
  const { t } = useI18n()
  const periods = PERIODS(t)
  const [period, setPeriod] = useState('daily')
  const [chartMode, setChartMode] = useState<'kline' | 'minute'>('minute')
  const [showMA, setShowMA] = useState(false)
  const [showBoll, setShowBoll] = useState(false)
  const [showChip, setShowChip] = useState(false)
  const [sub, setSub] = useState<SubIndicator | null>(null)
  const { quote, loading: quoteLoading, error: quoteError } = useStockQuote(code)
  const { data: klineData, loading: klineLoading, error: klineError } = useKLine(code, period)
  const { data: minuteData, prevClose, minuteDate, loading: minuteLoading } = useMinuteLine(chartMode === 'minute' ? code : null)
  const { brief } = useStockBrief(code)
  const { sentiment } = useStockSentiment(code, quote?.name ?? '')

  // Multi-market hooks — market must be declared before useFundFlow/useCyqData
  const market = useMemo(() => detectMarket(code), [code])
  const { data: fundFlowData } = useFundFlow(market === 'CN' ? code : null)
  const { data: cyqData } = useCyqData(market === 'CN' ? code : null, period)
  const { setMarketContext } = useChatContext()

  const { data: hkQuote, loading: hkQuoteLoading } = useHKQuote(market === 'HK' ? code : null)
  const { data: hkKlineData, loading: hkKlineLoading, error: hkKlineError } = useHKKLine(market === 'HK' ? code : null, period)
  const { data: usQuote, loading: usQuoteLoading } = useUSQuote(market === 'US' ? code : null)
  const { data: usKlineData, loading: usKlineLoading, error: usKlineError } = useUSKLine(market === 'US' ? code : null, period)

  // Unified data
  const crossQuote = market === 'HK' ? hkQuote : market === 'US' ? usQuote : quote
  const crossQuoteLoading = market === 'HK' ? hkQuoteLoading : market === 'US' ? usQuoteLoading : quoteLoading
  const crossKlineData = market === 'HK' ? hkKlineData : market === 'US' ? usKlineData : klineData
  const crossKlineLoading = market === 'HK' ? hkKlineLoading : market === 'US' ? usKlineLoading : klineLoading
  const crossKlineError = market === 'HK' ? hkKlineError : market === 'US' ? usKlineError : klineError
  const isForeign = market === 'HK' || market === 'US'

  // Auto-set market context when viewing a stock, so AI chat knows which stock user is looking at
  useEffect(() => {
    if (crossQuote) {
      setMarketContext({
        type: 'stock',
        label: `${crossQuote.name} (${crossQuote.code})`,
        data: {
          code: crossQuote.code,
          name: crossQuote.name,
          price: crossQuote.latest_price,
          prevClose: crossQuote.prev_close,
          changePct: crossQuote.change_pct,
          changeAmount: crossQuote.change_amount,
          open: crossQuote.open,
          high: crossQuote.high,
          low: crossQuote.low,
          volume: crossQuote.volume,
          amount: crossQuote.amount,
          turnover: crossQuote.turnover ?? 0,
          marketCap: brief?.market_cap,
          pe: brief?.pe,
          pb: brief?.pb,
          high52w: brief?.high_52w,
          low52w: brief?.low_52w,
          amplitude: brief?.amplitude,
          fundFlow: fundFlowData.length > 0 ? fundFlowData[fundFlowData.length - 1] : undefined,
        },
      })
    }
  }, [crossQuote, brief, fundFlowData, setMarketContext])

  const isUp = (crossQuote?.change_pct ?? 0) >= 0
  const color = isUp ? 'text-up' : 'text-down'

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border-color bg-bg-secondary">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary p-1">
          <ArrowLeft size={18} />
        </button>
        {crossQuoteLoading ? (
          <SkeletonQuote />
        ) : crossQuote ? (
          <>
            {isForeign && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${market === 'HK' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {market === 'HK' ? '港股' : '美股'}
              </span>
            )}
            <span className="text-sm font-semibold">{crossQuote.name}</span>
            <span className="text-xs text-text-secondary">{crossQuote.code}</span>
            <span className={`text-lg font-bold ml-4 ${color}`}>{crossQuote.latest_price?.toFixed(2)}</span>
            <span className={`text-sm ${color}`}>
              {isUp ? '+' : ''}{crossQuote.change_pct?.toFixed(2)}%  {isUp ? '+' : ''}{crossQuote.change_amount?.toFixed(2)}
            </span>
            {crossQuote.currency && (
              <span className="text-[10px] text-text-secondary ml-1">{crossQuote.currency}</span>
            )}
            {onChatWithAI && crossQuote && (
              <button
                onClick={() => onChatWithAI({
                  code: crossQuote.code,
                  name: crossQuote.name,
                  price: crossQuote.latest_price,
                  prevClose: crossQuote.prev_close,
                  changePct: crossQuote.change_pct,
                  changeAmount: crossQuote.change_amount,
                  open: crossQuote.open,
                  high: crossQuote.high,
                  low: crossQuote.low,
                  volume: crossQuote.volume,
                  amount: crossQuote.amount,
                  turnover: crossQuote.turnover ?? 0,
                  marketCap: brief?.market_cap,
                  pe: brief?.pe,
                  pb: brief?.pb,
                  high52w: brief?.high_52w,
                  low52w: brief?.low_52w,
                  amplitude: brief?.amplitude,
                })}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 rounded hover:bg-accent-blue/20 transition"
              >
                <MessageSquare size={14} />
                {t('stockdetail.aiChat')}
              </button>
            )}
          </>
        ) : null}
      </div>

      {/* Chart */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-0.5">
              {!isForeign && (
                <button
                  onClick={() => setChartMode('minute')}
                  className={`px-2 py-0.5 text-[10px] rounded ${
                    chartMode === 'minute'
                      ? 'bg-accent-blue text-white'
                      : 'text-text-secondary hover:text-text-primary bg-bg-primary'
                  }`}
                >
                  {t('stockdetail.chart.minute')}
                </button>
              )}
              <button
                onClick={() => setChartMode('kline')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  chartMode === 'kline' || isForeign
                    ? 'bg-accent-blue text-white'
                    : 'text-text-secondary hover:text-text-primary bg-bg-primary'
                }`}
              >
                {t('stockdetail.chart.kline')}
              </button>
            </div>
            <div className="flex gap-0.5 flex-wrap justify-end">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-2 py-0.5 text-[10px] rounded ${
                    period === p.key
                      ? 'bg-accent-blue text-white'
                      : 'text-text-secondary hover:text-text-primary bg-bg-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {!isForeign && chartMode === 'minute' ? (
            minuteLoading ? (
              <SkeletonChart height={420} />
            ) : (
              <MinuteChart data={minuteData} prevClose={prevClose || crossQuote?.prev_close || 0} date={minuteDate} height={420} />
            )
          ) : crossKlineLoading ? (
            <SkeletonChart height={420} />
          ) : (
            <>
              <div className="flex items-center gap-1 flex-wrap mb-2">
                <span className="text-[10px] text-text-secondary/50 mr-1">{t('stockdetail.chart.indicator')}:</span>
                {([
                  { key: 'ma' as const, label: 'MA', active: showMA, disabled: false, onClick: () => setShowMA(!showMA) },
                  { key: 'boll' as const, label: 'BOLL', active: showBoll, disabled: !crossKlineData.some((d: any) => d.boll_mid != null), onClick: () => setShowBoll(!showBoll) },
                  { key: 'macd' as const, label: 'MACD', active: sub === 'macd', disabled: !crossKlineData.some((d: any) => d.dif != null), onClick: () => setSub(sub === 'macd' ? null : 'macd') },
                  { key: 'kdj' as const, label: 'KDJ', active: sub === 'kdj', disabled: !crossKlineData.some((d: any) => d.kdj_k != null), onClick: () => setSub(sub === 'kdj' ? null : 'kdj') },
                  { key: 'rsi' as const, label: 'RSI', active: sub === 'rsi', disabled: !crossKlineData.some((d: any) => d.rsi6 != null), onClick: () => setSub(sub === 'rsi' ? null : 'rsi') },
                  ...(!isForeign ? [{ key: 'chip' as const, label: t('stockdetail.chart.chip'), active: showChip, disabled: !(cyqData && cyqData.chips && cyqData.chips.length > 0) && crossKlineData.length < 20, onClick: () => setShowChip(!showChip) }] : []),
                ]).map((btn) => (
                  <button
                    key={btn.key}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    className={`px-2 py-0.5 text-[10px] rounded ${
                      btn.disabled
                        ? 'text-text-secondary/25 cursor-not-allowed bg-bg-primary'
                        : btn.active
                          ? 'bg-accent-blue text-white'
                          : 'text-text-secondary/50 hover:text-text-secondary bg-bg-primary'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <KLineChart
                data={crossKlineData}
                height={420}
                error={crossKlineError}
                cyqData={isForeign ? null : cyqData}
                showMA={showMA}
                onToggleMA={() => setShowMA(!showMA)}
                showBoll={showBoll}
                onToggleBoll={() => setShowBoll(!showBoll)}
                showChip={showChip && !isForeign}
                onToggleChip={() => setShowChip(!showChip)}
                sub={sub}
                onToggleSub={(key) => setSub(sub === key ? null : key)}
              />
            </>
          )}
        </div>

        {/* Bid/Ask Depth Panel — A-share only */}
        {crossQuote && !isForeign && (
          <div className="card">
            <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">{t('stockdetail.depth.panel')}</h3>
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <DepthPanel quote={quote as StockQuote} />
              </div>
            </div>
          </div>
        )}

        {/* O/H/L/Volume/Amount stats — all markets */}
        {crossQuote && (
          <div className="card">
            <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">{t('stockdetail.quote.title')}</h3>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.open')}</span>
                <p className="text-text-primary mt-0.5">{crossQuote.open?.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.high')}</span>
                <p className="text-up mt-0.5">{crossQuote.high?.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.low')}</span>
                <p className="text-down mt-0.5">{crossQuote.low?.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.turnover')}</span>
                <p className="text-text-primary mt-0.5">
                  {brief?.turnover ? `${brief.turnover.toFixed(2)}%` : (crossQuote.turnover ?? 0) > 0 ? `${(crossQuote.turnover ?? 0).toFixed(2)}%` : '--'}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.volume')}</span>
                <p className="text-text-primary mt-0.5">{fmtVol(crossQuote.volume)}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.quote.amount')}</span>
                <p className="text-text-primary mt-0.5">{fmtAmt(crossQuote.amount)}</p>
              </div>
              {isForeign && crossQuote.currency && (
                <div>
                  <span className="text-text-secondary">{t('stockdetail.quote.currency')}</span>
                  <p className="text-text-primary mt-0.5">{crossQuote.currency}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fundamental data — A-share + US */}
        {!isForeign && brief && (
          <div className="card mb-4">
            <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">{t('stockdetail.fundamentals.title')}</h3>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.marketCap')}</span>
                <p className="text-text-primary mt-0.5">{brief.market_cap > 0 ? `${brief.market_cap.toFixed(0)}亿` : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.pe')}</span>
                <p className="text-text-primary mt-0.5">{brief.pe > 0 ? brief.pe.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.pb')}</span>
                <p className="text-text-primary mt-0.5">{brief.pb > 0 ? brief.pb.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.amplitude')}</span>
                <p className="text-text-primary mt-0.5">{brief.amplitude > 0 ? `${brief.amplitude.toFixed(2)}%` : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.high52w')}</span>
                <p className="text-up mt-0.5">{brief.high_52w > 0 ? brief.high_52w.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.low52w')}</span>
                <p className="text-down mt-0.5">{brief.low_52w > 0 ? brief.low_52w.toFixed(2) : '--'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Foreign (HK + US) fundamentals */}
        {isForeign && crossQuote && (
          <div className="card mb-4">
            <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">{t('stockdetail.fundamentals.title')}</h3>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.marketCap')}</span>
                <p className="text-text-primary mt-0.5">
                  {(() => {
                    const mc = (crossQuote as any).market_cap || 0
                    if (mc <= 0) return '--'
                    // Yahoo returns raw $, Tencent HK returns HKD. Show in 亿 if > 1e8, else raw with unit.
                    return mc >= 1e8 ? `${(mc / 1e8).toFixed(0)}亿` : `${mc.toFixed(2)}`
                  })()}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.pe')}</span>
                <p className="text-text-primary mt-0.5">{(crossQuote as any).pe > 0 ? (crossQuote as any).pe.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.pb')}</span>
                <p className="text-text-primary mt-0.5">{(crossQuote as any).pb > 0 ? (crossQuote as any).pb.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.amplitude')}</span>
                <p className="text-text-primary mt-0.5">
                  {(crossQuote as any).amplitude > 0
                    ? `${(crossQuote as any).amplitude.toFixed(2)}%`
                    : crossQuote.prev_close > 0
                      ? `${(((crossQuote.high - crossQuote.low) / crossQuote.prev_close) * 100).toFixed(2)}%`
                      : '--'}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.high52w')}</span>
                <p className="text-up mt-0.5">{(crossQuote as any).high_52w > 0 ? (crossQuote as any).high_52w.toFixed(2) : '--'}</p>
              </div>
              <div>
                <span className="text-text-secondary">{t('stockdetail.fundamentals.low52w')}</span>
                <p className="text-down mt-0.5">{(crossQuote as any).low_52w > 0 ? (crossQuote as any).low_52w.toFixed(2) : '--'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Decision Dashboard — all markets */}
        {crossQuote && (
          <div className="card mb-4">
            <h3 className="text-xs font-semibold text-accent-blue mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              AI 决策看板
            </h3>
            <AIDecisionPanel code={code} market={market} />
          </div>
        )}

        {/* Fund Flow — A-share only */}
        {fundFlowData.length > 0 && !isForeign && (
          <div className="card mb-4">
            <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">
              {t('stockdetail.fundflow.title')}
              <span className="text-[10px] font-normal ml-2">{t('stockdetail.fundflow.recentDays').replace('{days}', String(fundFlowData.length))}</span>
            </h3>
            <FundFlowChart data={fundFlowData} />
          </div>
        )}

        {/* AI Sentiment — A-share only */}
        {sentiment && sentiment.news.length > 0 && !isForeign && (
          <div className="card mb-4">
            <h3 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
              {t('stockdetail.sentiment.title')}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                sentiment.sentiment === 'positive' ? 'bg-up/20 text-up' :
                sentiment.sentiment === 'negative' ? 'bg-down/20 text-down' :
                'bg-text-secondary/20 text-text-secondary'
              }`}>
                {sentiment.sentiment === 'positive' ? t('stockdetail.sentiment.positive') : sentiment.sentiment === 'negative' ? t('stockdetail.sentiment.negative') : t('stockdetail.sentiment.neutral')}
              </span>
            </h3>
            <p className="text-xs text-text-primary mb-2">{sentiment.summary}</p>
            <div className="space-y-1">
              {sentiment.news.slice(0, 5).map((n: any, i: number) => (
                <a
                  key={i}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[10px] text-text-secondary hover:text-accent-blue truncate"
                >
                  {n.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
