import { describe, it, expect } from 'vitest'
import { CHART_COLORS, MA_DEFS, BOLL_COLORS, KDJ_COLORS, RSI_COLORS } from '../lib/chartTheme'

describe('CHART_COLORS', () => {
  it('has all required color keys', () => {
    const keys = ['bg', 'bgSecondary', 'text', 'textSecondary', 'grid', 'border',
      'up', 'down', 'upTransparent', 'downTransparent',
      'gold', 'purple', 'cyan', 'pink', 'amber', 'rose', 'white']
    for (const key of keys) {
      expect(CHART_COLORS).toHaveProperty(key)
    }
  })

  it('all values are valid hex colors', () => {
    const hexRe = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
    for (const [key, value] of Object.entries(CHART_COLORS)) {
      expect(value).toMatch(hexRe)
    }
  })

  it('up is red and down is green', () => {
    expect(CHART_COLORS.up).toBe('#ef4444')
    expect(CHART_COLORS.down).toBe('#22c55e')
  })
})

describe('MA_DEFS', () => {
  it('has 4 moving average definitions', () => {
    expect(MA_DEFS).toHaveLength(4)
  })

  it('each definition has key, label, and color', () => {
    for (const def of MA_DEFS) {
      expect(def).toHaveProperty('key')
      expect(def).toHaveProperty('label')
      expect(def).toHaveProperty('color')
      expect(def.label).toContain('MA')
    }
  })
})

describe('BOLL_COLORS', () => {
  it('has up, mid, and low keys', () => {
    expect(BOLL_COLORS).toHaveProperty('up')
    expect(BOLL_COLORS).toHaveProperty('mid')
    expect(BOLL_COLORS).toHaveProperty('low')
  })
})

describe('KDJ_COLORS', () => {
  it('has 3 colors', () => {
    expect(KDJ_COLORS).toHaveLength(3)
  })
})

describe('RSI_COLORS', () => {
  it('has rsi6, rsi12, rsi24 keys', () => {
    expect(RSI_COLORS).toHaveProperty('rsi6')
    expect(RSI_COLORS).toHaveProperty('rsi12')
    expect(RSI_COLORS).toHaveProperty('rsi24')
  })
})
