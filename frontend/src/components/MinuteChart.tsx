import { useEffect, useRef } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type IPriceLine, type Time } from 'lightweight-charts'
import type { MinuteBar } from '../types'
import { useI18n } from '../i18n/I18nProvider'
import { CHART_COLORS } from '../lib/chartTheme'

interface Props {
  data: MinuteBar[]
  prevClose: number
  date?: string
  height?: number
}

const KEY_TIMES = new Set(['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'])

function toTimestamp(displayDate: string, time: string): number {
  const [h, m] = time.split(':').map(Number)
  const [y, mo, d] = displayDate.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m).getTime() / 1000
}

export default function MinuteChart({ data, prevClose, date, height = 420 }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const priceSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const avgSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const volSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const prevCloseLineRef = useRef<IPriceLine | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<MinuteBar[]>([])
  const initialFitDoneRef = useRef(false)
  const lastDataSetRef = useRef('')

  const displayDate = date || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })()

  const prevCloseRef = useRef(prevClose)
  const displayDateRef = useRef(displayDate)

  // ── Create chart ──
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bgSecondary },
        textColor: CHART_COLORS.textSecondary,
      },
      grid: {
        vertLines: { color: CHART_COLORS.border },
        horzLines: { color: CHART_COLORS.border },
      },
      crosshair: { mode: 0 },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: unknown) => {
          const d = new Date((time as number) * 1000)
          const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          return KEY_TIMES.has(t) ? t : ''
        },
      },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      leftPriceScale: { visible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })

    const priceSeries = chart.addLineSeries({
      color: CHART_COLORS.white,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const avgSeries = chart.addLineSeries({
      color: CHART_COLORS.amber,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const volSeries = chart.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    priceSeriesRef.current = priceSeries
    avgSeriesRef.current = avgSeries
    volSeriesRef.current = volSeries

    chart.subscribeCrosshairMove((param) => {
      try {
        const el = tooltipRef.current
        if (!el) return
        if (!param.point || !param.time) {
          el.style.display = 'none'
          return
        }

        const crossMs = (param.time as number) * 1000
        const items = dataRef.current
        if (!items.length) return
        let nearest = items[0]
        let best = Infinity
        for (const d of items) {
          const t = toTimestamp(displayDateRef.current, d.time) * 1000
          const diff = Math.abs(t - crossMs)
          if (diff < best) { best = diff; nearest = d }
        }

        const pc = prevCloseRef.current
        const chg = pc ? ((nearest.price - pc) / pc * 100) : 0
        const up = chg >= 0

        const h = Math.floor(crossMs / 3600000) % 24
        const m = Math.floor((crossMs % 3600000) / 60000)
        const hoverTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

        el.innerHTML = [
          `<span class="text-accent-blue">${hoverTime}</span>`,
          `<span class="ml-1.5">价格 <span style="color:${CHART_COLORS.white}">${nearest.price.toFixed(2)}</span></span>`,
          `<span class="ml-1.5">均价 <span style="color:${CHART_COLORS.amber}">${nearest.avg_price.toFixed(2)}</span></span>`,
          `<span class="ml-1.5 ${up ? 'text-up' : 'text-down'}">${up ? '+' : ''}${chg.toFixed(2)}%</span>`,
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

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      priceSeriesRef.current = null
      avgSeriesRef.current = null
      volSeriesRef.current = null
      prevCloseLineRef.current = null
    }
  }, [height])

  // ── Update data ──
  useEffect(() => {
    const chart = chartRef.current
    const priceSeries = priceSeriesRef.current
    const avgSeries = avgSeriesRef.current
    const volSeries = volSeriesRef.current
    if (!chart || !priceSeries || !avgSeries || !volSeries || !data.length) return

    dataRef.current = data
    prevCloseRef.current = prevClose
    displayDateRef.current = displayDate

    if (prevCloseLineRef.current) {
      try { priceSeries.removePriceLine(prevCloseLineRef.current) } catch { /* ok */ }
      prevCloseLineRef.current = null
    }

    if (prevClose > 0) {
      prevCloseLineRef.current = priceSeries.createPriceLine({
        price: prevClose,
        color: CHART_COLORS.textSecondary,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: t('stockdetail.quote.prevClose'),
      })
    }

    priceSeries.setData(data.map((bar) => ({
      time: toTimestamp(displayDate, bar.time) as Time,
      value: bar.price,
    })))

    avgSeries.setData(data
      .filter((bar) => bar.avg_price > 0)
      .map((bar) => ({
        time: toTimestamp(displayDate, bar.time) as Time,
        value: bar.avg_price,
      })))

    volSeries.setData(data.map((bar, i) => {
      const prevPrice = i > 0 ? data[i - 1].price : prevClose
      return {
        time: toTimestamp(displayDate, bar.time) as Time,
        value: bar.volume,
        color: bar.price >= prevPrice ? CHART_COLORS.upTransparent : CHART_COLORS.downTransparent,
      }
    }))

    const dataSetId = `${displayDate}:${data[0]?.time ?? ''}`
    if (!initialFitDoneRef.current || lastDataSetRef.current !== dataSetId) {
      chart.timeScale().fitContent()
      initialFitDoneRef.current = true
      lastDataSetRef.current = dataSetId
    }
  }, [data, prevClose, displayDate, height])

  const hasData = data.length > 0
  const latest = hasData ? data[data.length - 1] : null
  const change = (prevClose && latest) ? ((latest.price - prevClose) / prevClose * 100) : 0
  const color = change >= 0 ? 'text-up' : 'text-down'

  let dayHigh = latest?.price ?? 0
  let dayLow = latest?.price ?? 0
  data.forEach((bar) => {
    if (bar.price > dayHigh) dayHigh = bar.price
    if (bar.price < dayLow) dayLow = bar.price
  })

  return (
    <div className="relative" style={{ height }}>
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-xs z-10 pointer-events-none">
          {t('stockdetail.chart.noMinuteData')}
        </div>
      )}
      {hasData && (
        <div className="absolute top-2 left-3 z-10 flex items-center gap-3 text-[10px]">
          <span className="text-text-secondary">{displayDate}</span>
          <span style={{ color: CHART_COLORS.white }}>{t('stockdetail.quote.price')} {latest!.price.toFixed(2)}</span>
          <span style={{ color: CHART_COLORS.amber }}>{t('stockdetail.quote.avgPrice')} {latest!.avg_price.toFixed(2)}</span>
          <span className={`font-medium ${color}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
          <span className="text-text-secondary">{t('stockdetail.quote.prevClose')} {prevClose.toFixed(2)}</span>
          <span className="text-text-secondary">{t('stockdetail.quote.high')} {dayHigh.toFixed(2)}</span>
          <span className="text-text-secondary">{t('stockdetail.quote.low')} {dayLow.toFixed(2)}</span>
        </div>
      )}
      <div
        ref={tooltipRef}
        className="absolute top-1 right-3 z-10 text-[10px] bg-bg-card/90 px-2 py-0.5 rounded pointer-events-none"
        style={{ display: 'none' }}
      />
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  )
}
