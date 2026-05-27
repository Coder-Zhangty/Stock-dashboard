import { describe, it, expect } from 'vitest'
import { normalizeCodeLanguage, highlightCode } from '../lib/codeHighlight'

describe('normalizeCodeLanguage', () => {
  it('returns "code" for falsy input', () => {
    expect(normalizeCodeLanguage('')).toBe('code')
    expect(normalizeCodeLanguage(undefined)).toBe('code')
  })

  it('maps aliases correctly', () => {
    expect(normalizeCodeLanguage('js')).toBe('javascript')
    expect(normalizeCodeLanguage('ts')).toBe('typescript')
    expect(normalizeCodeLanguage('py')).toBe('python')
    expect(normalizeCodeLanguage('sh')).toBe('bash')
    expect(normalizeCodeLanguage('shell')).toBe('bash')
    expect(normalizeCodeLanguage('md')).toBe('markdown')
    expect(normalizeCodeLanguage('html')).toBe('markup')
  })

  it('passes through unknown languages', () => {
    expect(normalizeCodeLanguage('rust')).toBe('rust')
    expect(normalizeCodeLanguage('go')).toBe('go')
  })

  it('lowercases and trims input', () => {
    expect(normalizeCodeLanguage('  JS  ')).toBe('javascript')
    expect(normalizeCodeLanguage('Py')).toBe('python')
  })
})

describe('highlightCode', () => {
  it('returns language label and html for known language', () => {
    const result = highlightCode('const x = 1;', 'javascript')
    expect(result).toHaveProperty('languageLabel')
    expect(result).toHaveProperty('highlightedHtml')
    expect(result.languageLabel).toBe('javascript')
    expect(typeof result.highlightedHtml).toBe('string')
  })

  it('falls back to escaped HTML for unknown language', () => {
    const result = highlightCode('<div class="test">hello</div>', 'unknown-lang')
    expect(result.languageLabel).toBe('unknown-lang')
    expect(result.highlightedHtml).toContain('&lt;')
    expect(result.highlightedHtml).toContain('&gt;')
  })

  it('handles empty code', () => {
    const result = highlightCode('', 'javascript')
    expect(result.languageLabel).toBe('javascript')
    expect(result.highlightedHtml).toBe('')
  })
})
