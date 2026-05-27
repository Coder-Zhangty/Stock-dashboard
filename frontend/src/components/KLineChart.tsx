import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from 'lightweight-charts'
import type { KLineItem, CyqData } from '../types'
import { calculateCyq } from '../lib/cyqCalc'
import { useI18n } from '../i18n/I18nProvider'
import { CHART_COLORS, MA_DEFS, BOLL_COLORS, KDJ_COLORS, RSI_COLORS } from '../lib/chartTheme'

interface Props {
  data: KLineItem[]
  height?: number
  error?: string | null
  cyqData?: CyqData | null
  showMA: boolean
  onToggleMA: () => void
  showBoll: boolean
  onToggleBoll: () => void
  showChip: boolean
  onToggleChip: () => void
  sub: SubIndicator | null
  onToggleSub: (key: SubIndicator) => void
}

export type SubIndicator = 'macd' | 'kdj' | 'rsi'

function toChartTime(dateStr: string): Time {
  if (dateStr.includes(' ')) {
    return Math.floor(new Date(dateStr.replace(' ', 'T')).getTime() / 1000) as Time
  }
  return Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000) as Time
}

export default function KLineChart({ data, height = 500, error, cyqData, showMA, onToggleMA, showBoll, onToggleBoll, showChip, onToggleChip, sub, onToggleSub }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const seriesRef = useRef<{
    candle: ISeriesApi<'Candlestick'> | null
    volume: ISeriesApi<'Histogram'> | null
    ma: ISeriesApi<'Line'>[]
    boll: ISeriesApi<'Line'>[]
    macdDIF: ISeriesApi<'Line'> | null
    macdDEA: ISeriesApi<'Line'> | null
    macdHist: ISeriesApi<'Histogram'> | null
    kdj: ISeriesApi<'Line'>[]
    rsi: ISeriesApi<'Line'>[]
  }>({
    candle: null, volume: null, ma: [], boll: [],
    macdDIF: null, macdDEA: null, macdHist: null, kdj: [], rsi: [],
  })

  const chipCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawChipRef = useRef<() => void>(() => {})
  const dataRef = useRef<KLineItem[]>([])
  const crosshairDateRef = useRef<string | null>(null)

  // Check what the current data actually contains
  const hasMA = data.some((d) => d.ma5 != null)
  const hasBoll = data.some((d) => d.boll_mid != null)
  const hasMacd = data.some((d) => d.dif != null)
  const hasKdj = data.some((d) => d.kdj_k != null)
  const hasRsi = data.some((d) => d.rsi6 != null)
  const hasCyq = !!(cyqData && cyqData.chips && cyqData.chips.length > 0) || data.length >= 20

  // effective sub-indicator: only active if data supports it
  const effectiveSub: SubIndicator | null =
    sub === 'macd' && hasMacd ? 'macd' :
    sub === 'kdj' && hasKdj ? 'kdj' :
    sub === 'rsi' && hasRsi ? 'rsi' :
    null

  // ── Chart Init (runs once per height change) ──
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bg },
        textColor: CHART_COLORS.text,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: { mode: 0 },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
      },
      rightPriceScale: { borderColor: CHART_COLORS.border, autoScale: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })

    const candle = chart.addCandlestickSeries({
      upColor: CHART_COLORS.up, downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up, borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up, wickDownColor: CHART_COLORS.down,
    })

    const vol = chart.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
    })

    const maLines = MA_DEFS.map((m) =>
      chart.addLineSeries({ color: m.color, lineWidth: 1, priceScaleId: 'right' })
    )

    const bollUp = chart.addLineSeries({ color: BOLL_COLORS.up, lineWidth: 1, priceScaleId: 'right' })
    const bollMid = chart.addLineSeries({ color: BOLL_COLORS.mid, lineWidth: 1, lineStyle: 2, priceScaleId: 'right' })
    const bollLow = chart.addLineSeries({ color: BOLL_COLORS.low, lineWidth: 1, priceScaleId: 'right' })

    seriesRef.current = {
      candle, volume: vol, ma: maLines,
      boll: [bollUp, bollMid, bollLow],
      macdDIF: null, macdDEA: null, macdHist: null,
      kdj: [], rsi: [],
    }
    chartRef.current = chart

    // Default 2-pane layout
    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0, bottom: 0.28 } })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.72, bottom: 0 } })

    // Crosshair: free movement (mode 0) + nearest-candle exact values
    chart.subscribeCrosshairMove((param) => {
      try {
        const el = tooltipRef.current
        if (!el) return
        if (!param.point || !param.time) {
          el.style.display = 'none'
          if (crosshairDateRef.current !== null) {
            crosshairDateRef.current = null
            requestAnimationFrame(() => drawChipRef.current())
          }
          return
        }

        // Convert crosshair time to ms for comparison
        let crossMs: number
        if (typeof param.time === 'number') {
          crossMs = param.time * 1000
        } else if (typeof param.time === 'string') {
          crossMs = new Date(param.time).getTime()
        } else {
          crossMs = 0
        }
        if (!crossMs) { el.style.display = 'none'; return }

        // Find nearest actual data point (with index for prev_close)
        const items = dataRef.current
        if (!items.length) return
        let nearest = items[0]
        let nearestIdx = 0
        let best = Infinity
        for (let i = 0; i < items.length; i++) {
          const d = items[i]
          const diff = Math.abs(new Date(d.trade_date.replace(' ', 'T')).getTime() - crossMs)
          if (diff < best) { best = diff; nearest = d; nearestIdx = i }
        }

        const prevClose = nearestIdx > 0 ? items[nearestIdx - 1].close : nearest.open
        const change = nearest.close - prevClose
        const pct = prevClose > 0 ? ((change / prevClose) * 100).toFixed(2) : '0.00'
        const up = change >= 0

        // Trigger chip peak redraw for this bar's date
        if (nearest.trade_date !== crosshairDateRef.current) {
          crosshairDateRef.current = nearest.trade_date
          requestAnimationFrame(() => drawChipRef.current())
        }

        el.innerHTML = [
          `<span class="text-accent-blue">${nearest.trade_date}</span>`,
          `<span class="text-text-secondary ml-2">O</span> ${nearest.open.toFixed(2)}`,
          `<span class="text-text-secondary ml-1">H</span> <span class="text-up">${nearest.high.toFixed(2)}</span>`,
          `<span class="text-text-secondary ml-1">L</span> <span class="text-down">${nearest.low.toFixed(2)}</span>`,
          `<span class="text-text-secondary ml-1">C</span> <span class="${up ? 'text-up' : 'text-down'}">${nearest.close.toFixed(2)}</span>`,
          `<span class="${up ? 'text-up' : 'text-down'} ml-1.5">${up ? '+' : ''}${change.toFixed(2)} (${up ? '+' : ''}${pct}%)</span>`,
        ].join('')
        el.style.display = 'block'
      } catch {
        // silently ignore
      }
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(() => drawChipRef.current())
    })

    return () => { ro.disconnect(); chart.remove() }
  }, [height])

  // ── Chip peak drawing ──
  useEffect(() => {
    drawChipRef.current = () => {
      try {
        const chart = chartRef.current
        const canvas = chipCanvasRef.current
        const container = containerRef.current
        if (!chart || !canvas || !container || !showChip) return

        const mainRatio = effectiveSub ? 0.52 : 0.72
        const mainH = container.clientHeight * mainRatio
        if (mainH <= 0) return

        const dpr = window.devicePixelRatio || 1
        const w = 100
        const cw = Math.round(w * dpr)
        const ch = Math.round(mainH * dpr)
        if (cw <= 0 || ch <= 0) return

        // Determine target index for CYQ calculation
        const klines = dataRef.current
        let targetIndex = klines.length - 1
        const crossDate = crosshairDateRef.current
        if (crossDate) {
          const found = klines.findIndex((k) => k.trade_date === crossDate)
          if (found >= 0) targetIndex = found
        }

        // Calculate CYQ for the target bar
        const computedCyq = calculateCyq(klines, targetIndex)
        const displayCyq = computedCyq || cyqData
        if (!displayCyq || !displayCyq.chips || displayCyq.chips.length === 0) return

        canvas.width = cw
        canvas.height = ch
        canvas.style.width = `${w}px`
        canvas.style.height = `${mainH}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, w, mainH)

        const candleSeries = seriesRef.current.candle
        if (!candleSeries) return

        const chips = displayCyq.chips
        const prices = displayCyq.prices
        const latest = displayCyq.latest_price
        const avgCost = displayCyq.avg_cost

        let maxChip = 1
        for (let i = 0; i < chips.length; i++) {
          if (chips[i] > maxChip) maxChip = chips[i]
        }

        // Draw chip bars
        const BAR_H = Math.max(1, mainH / 150)
        for (let i = 0; i < prices.length; i++) {
          const price = prices[i]
          const y = candleSeries.priceToCoordinate(price)
          if (y === null || y < 0 || y > mainH) continue

          const chipVal = chips[i]
          const barW = (chipVal / maxChip) * 88
          if (barW < 0.5) continue

          const isProfit = price < latest
          ctx.fillStyle = isProfit ? 'rgba(239, 68, 68, 0.55)' : 'rgba(34, 197, 94, 0.45)' // kept as direct rgba for canvas performance
          ctx.fillRect(0, y - BAR_H / 2, barW, Math.max(BAR_H, 1))
        }

        // Current price line
        const priceY = candleSeries.priceToCoordinate(latest)
        if (priceY !== null && priceY >= 0 && priceY <= mainH) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 3])
          ctx.beginPath()
          ctx.moveTo(0, priceY)
          ctx.lineTo(w, priceY)
          ctx.stroke()
          ctx.setLineDash([])

          ctx.fillStyle = '#fff'
          ctx.font = 'bold 10px monospace'
          ctx.textAlign = 'left'
          ctx.fillText(latest.toFixed(2), 4, priceY - 3)
        }

        // Average cost line
        if (avgCost > 0) {
          const avgY = candleSeries.priceToCoordinate(avgCost)
          if (avgY !== null && avgY >= 0 && avgY <= mainH) {
            ctx.strokeStyle = '#fbbf24'
            ctx.lineWidth = 1
            ctx.setLineDash([2, 4])
            ctx.beginPath()
            ctx.moveTo(0, avgY)
            ctx.lineTo(w, avgY)
            ctx.stroke()
            ctx.setLineDash([])

            ctx.fillStyle = '#fbbf24'
            ctx.font = '9px monospace'
            ctx.textAlign = 'left'
            ctx.fillText(`成本 ${avgCost.toFixed(2)}`, 4, avgY - 2)
          }
        }

        // Profit ratio label at bottom
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'left'
        const pr = displayCyq.profit_ratio ?? 0
        ctx.fillText(`获利 ${(pr * 100).toFixed(1)}%`, 4, mainH - 4)
      } catch {
        // Silently ignore drawing errors
      }
    }

    drawChipRef.current()
  }, [showChip, cyqData, effectiveSub])

  // ── Data + Indicator management ──
  useEffect(() => {
    const s = seriesRef.current
    const chart = chartRef.current
    if (!s.candle || !s.volume || !chart || !data.length) return

    dataRef.current = data

    // Build candle data with A-share coloring (close vs prev_close, not close vs open)
    const candleData: CandlestickData[] = []
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const prevClose = i > 0 ? data[i - 1].close : d.open
      const dayUp = d.close >= prevClose
      candleData.push({
        time: toChartTime(d.trade_date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        color: dayUp ? CHART_COLORS.up : CHART_COLORS.down,
        borderColor: dayUp ? CHART_COLORS.up : CHART_COLORS.down,
        wickColor: dayUp ? CHART_COLORS.up : CHART_COLORS.down,
      })
    }
    s.candle.setData(candleData)

    // Volume bars: same A-share coloring (close vs prev_close)
    s.volume.setData(data.map((d, i) => {
      const prevClose = i > 0 ? data[i - 1].close : d.open
      return {
        time: toChartTime(d.trade_date),
        value: d.volume,
        color: d.close >= prevClose ? CHART_COLORS.upTransparent : CHART_COLORS.downTransparent,
      }
    }))

    // MA overlay — set or clear
    MA_DEFS.forEach((m, i) => {
      if (showMA && hasMA) {
        s.ma[i]?.setData(data
          .filter((d) => d[m.key] != null)
          .map((d) => ({ time: toChartTime(d.trade_date), value: d[m.key] as number })))
      } else {
        s.ma[i]?.setData([])
      }
    })

    // BOLL overlay — set or clear
    const bollKeys = ['boll_up', 'boll_mid', 'boll_low'] as const
    bollKeys.forEach((key, i) => {
      if (showBoll && hasBoll) {
        s.boll[i]?.setData(data
          .filter((d) => d[key] != null)
          .map((d) => ({ time: toChartTime(d.trade_date), value: d[key] as number })))
      } else {
        s.boll[i]?.setData([])
      }
    })

    // ── Sub-indicator panes (mutually exclusive, all use priceScaleId 'sub') ──

    // MACD
    if (effectiveSub === 'macd') {
      if (!s.macdDIF) {
        s.macdDIF = chart.addLineSeries({ color: CHART_COLORS.gold, lineWidth: 1, priceScaleId: 'sub' })
        s.macdDEA = chart.addLineSeries({ color: CHART_COLORS.purple, lineWidth: 1, priceScaleId: 'sub' })
        s.macdHist = chart.addHistogramSeries({ priceScaleId: 'sub' })
      }
      s.macdDIF.setData(data.filter((d) => d.dif != null).map((d) => ({ time: toChartTime(d.trade_date), value: d.dif! })))
      s.macdDEA.setData(data.filter((d) => d.dea != null).map((d) => ({ time: toChartTime(d.trade_date), value: d.dea! })))
      s.macdHist.setData(data.filter((d) => d.macd != null).map((d) => ({
        time: toChartTime(d.trade_date), value: d.macd!,
        color: d.macd! >= 0 ? CHART_COLORS.upTransparent : CHART_COLORS.downTransparent,
      })))
    } else {
      if (s.macdDIF) { chart.removeSeries(s.macdDIF); s.macdDIF = null }
      if (s.macdDEA) { chart.removeSeries(s.macdDEA); s.macdDEA = null }
      if (s.macdHist) { chart.removeSeries(s.macdHist); s.macdHist = null }
    }

    // KDJ
    if (effectiveSub === 'kdj') {
      if (s.kdj.length === 0) {
        s.kdj = KDJ_COLORS.map((c) => chart.addLineSeries({ color: c, lineWidth: 1, priceScaleId: 'sub' }))
      }
      ;['kdj_k', 'kdj_d', 'kdj_j'].forEach((key, i) => {
        s.kdj[i]?.setData(data
          .filter((d) => d[key as keyof KLineItem] != null)
          .map((d) => ({ time: toChartTime(d.trade_date), value: d[key as keyof KLineItem] as number })))
      })
    } else {
      if (s.kdj.length > 0) { s.kdj.forEach((x) => chart.removeSeries(x)); s.kdj = [] }
    }

    // RSI
    if (effectiveSub === 'rsi') {
      if (s.rsi.length === 0) {
        s.rsi = Object.values(RSI_COLORS).map((c) => chart.addLineSeries({ color: c, lineWidth: 1, priceScaleId: 'sub' }))
      }
      ;['rsi6', 'rsi12', 'rsi24'].forEach((key, i) => {
        s.rsi[i]?.setData(data
          .filter((d) => d[key as keyof KLineItem] != null)
          .map((d) => ({ time: toChartTime(d.trade_date), value: d[key as keyof KLineItem] as number })))
      })
    } else {
      if (s.rsi.length > 0) { s.rsi.forEach((x) => chart.removeSeries(x)); s.rsi = [] }
    }

    // ── Pane layout ──
    if (effectiveSub) {
      // 3 panes: main 52%, volume 16%, sub-indicator 32%
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0, bottom: 0.48 } })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.52, bottom: 0.32 } })
      chart.priceScale('sub').applyOptions({ scaleMargins: { top: 0.68, bottom: 0 } })
    } else {
      // 2 panes: main 72%, volume 28%
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0, bottom: 0.28 } })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.72, bottom: 0 } })
    }

    chart.timeScale().fitContent()
  }, [data, showMA, showBoll, effectiveSub, height])

  if (error) {
    return <div className="flex items-center justify-center text-red-400 text-xs py-8" style={{ height }}>{t('stockdetail.chart.dataError')}: {error}</div>
  }
  if (!data.length) {
    return <div className="flex items-center justify-center text-text-secondary text-xs py-8" style={{ height }}>{t('stockdetail.chart.noData')}</div>
  }

  return (
    <div className="relative">
      {/* Top-right: crosshair floating tooltip */}
      <div
        ref={tooltipRef}
        className="absolute top-1 right-3 z-10 text-[10px] bg-bg-card/90 px-2 py-0.5 rounded pointer-events-none"
        style={{ display: 'none' }}
      />

      {/* Chip peak canvas overlay */}
      {showChip && hasCyq && (
        <canvas
          ref={chipCanvasRef}
          className="absolute right-0 top-0 pointer-events-none z-10"
          width={100}
          height={300}
          style={{ width: 100, height: 300, backgroundColor: 'rgba(22,22,28,0.85)' }}
        />
      )}

      <div ref={containerRef} />
    </div>
  )
}
