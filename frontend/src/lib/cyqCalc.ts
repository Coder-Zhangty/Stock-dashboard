import type { KLineItem, CyqData } from '../types'

const FACTOR = 150

function costRange(prices: number[], chips: number[], total: number, coverage: number) {
  const n = prices.length
  let peakIdx = 0
  let peakVal = chips[0]
  for (let i = 1; i < n; i++) {
    if (chips[i] > peakVal) { peakVal = chips[i]; peakIdx = i }
  }

  let lo = peakIdx
  let hi = peakIdx
  let acc = chips[peakIdx]
  const target = total * coverage

  while (acc < target && (lo > 0 || hi < n - 1)) {
    if (lo > 0 && hi < n - 1) {
      if (chips[lo - 1] > chips[hi + 1]) { lo-- }
      else if (chips[hi + 1] > chips[lo - 1]) { hi++ }
      else { lo--; hi++ }
    } else if (lo > 0) {
      lo--
    } else if (hi < n - 1) {
      hi++
    } else {
      break
    }
    acc += chips[lo]
    if (hi > lo) acc += chips[hi]
  }

  const lowPrice = prices[Math.max(0, lo)]
  const highPrice = prices[Math.min(n - 1, hi)]
  const conc = lowPrice > 0 ? (highPrice - lowPrice) / lowPrice : 0

  return { low: Math.round(lowPrice * 100) / 100, high: Math.round(highPrice * 100) / 100, conc: Math.round(conc * 10000) / 10000 }
}

export function calculateCyq(klines: KLineItem[], targetIndex: number): CyqData | null {
  const RANGE = Math.min(120, klines.length)
  if (RANGE < 20 || targetIndex < 0 || targetIndex >= klines.length) return null

  // Take the RANGE bars ending at targetIndex (inclusive)
  const startIdx = Math.max(0, targetIndex - RANGE + 1)
  const kdata = klines.slice(startIdx, targetIndex + 1)
  if (kdata.length < 20) return null

  let maxPrice = 0
  let minPrice = Infinity
  for (const k of kdata) {
    if (k.high > maxPrice) maxPrice = k.high
    if (k.low < minPrice) minPrice = k.low
  }
  if (minPrice <= 0 || maxPrice <= 0 || maxPrice <= minPrice) return null

  const accuracy = Math.max(0.01, (maxPrice - minPrice) / (FACTOR - 1))
  const prices: number[] = []
  for (let i = 0; i < FACTOR; i++) {
    prices.push(minPrice + accuracy * i)
  }
  const chips = new Array(FACTOR).fill(0)

  for (const k of kdata) {
    const o = k.open, c = k.close, h = k.high, l = k.low
    const avg = (o + c + h + l) / 4
    let turnover = k.turnover_rate
    if (turnover == null || turnover === 0) turnover = 2
    turnover = Math.min(1, turnover / 100)

    const hi = Math.floor((h - minPrice) / accuracy)
    const lo = Math.floor((l - minPrice) / accuracy + 0.5)
    const gIdx = Math.round((avg - minPrice) / accuracy)

    // Decay
    for (let n = 0; n < FACTOR; n++) {
      chips[n] *= (1 - turnover)
    }

    if (h === l) {
      if (gIdx >= 0 && gIdx < FACTOR) {
        chips[gIdx] += (FACTOR - 1) * turnover / 2
      }
    } else {
      const gp = 2 / (h - l)
      const jStart = Math.max(0, lo)
      const jEnd = Math.min(FACTOR - 1, hi)
      for (let j = jStart; j <= jEnd; j++) {
        const curPrice = minPrice + accuracy * j
        if (curPrice <= avg) {
          if (Math.abs(avg - l) < 1e-8) {
            chips[j] += gp * turnover
          } else {
            chips[j] += (curPrice - l) / (avg - l) * gp * turnover
          }
        } else {
          if (Math.abs(h - avg) < 1e-8) {
            chips[j] += gp * turnover
          } else {
            chips[j] += (h - curPrice) / (h - avg) * gp * turnover
          }
        }
      }
    }
  }

  let totalChips = 0
  for (let i = 0; i < FACTOR; i++) totalChips += chips[i]
  if (totalChips <= 0) return null

  const latest = kdata[kdata.length - 1]
  const latestPrice = latest.close
  if (latestPrice <= 0) return null

  let weightedSum = 0
  let profitChips = 0
  for (let i = 0; i < FACTOR; i++) {
    weightedSum += prices[i] * chips[i]
    if (prices[i] < latestPrice) profitChips += chips[i]
  }
  const avgCost = weightedSum / totalChips
  const profitRatio = profitChips / totalChips

  const r90 = costRange(prices, chips, totalChips, 0.9)
  const r70 = costRange(prices, chips, totalChips, 0.7)

  // Normalize chips
  let maxChip = 0
  for (let i = 0; i < FACTOR; i++) {
    if (chips[i] > maxChip) maxChip = chips[i]
  }
  const chipsNorm = chips.map(c => Math.round(c / maxChip * 1e6) / 1e6)
  const pricesRounded = prices.map(p => Math.round(p * 100) / 100)

  return {
    prices: pricesRounded,
    chips: chipsNorm,
    latest_price: Math.round(latestPrice * 100) / 100,
    profit_ratio: Math.round(profitRatio * 10000) / 10000,
    avg_cost: Math.round(avgCost * 100) / 100,
    cost90_low: r90.low, cost90_high: r90.high, concentration90: r90.conc,
    cost70_low: r70.low, cost70_high: r70.high, concentration70: r70.conc,
  }
}
