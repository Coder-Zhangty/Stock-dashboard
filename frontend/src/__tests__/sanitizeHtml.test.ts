import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../lib/sanitizeHtml'

describe('sanitizeHtml', () => {
  it('removes event handlers', () => {
    const input = '<span onclick="alert(1)">text</span>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onclick')
    expect(result).toContain('text')
  })

  it('removes javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">link</a>'
    const result = sanitizeHtml(input)
    expect(result).toContain('data-removed-href=')
    expect(result).toContain('>link</a>')
  })

  it('removes script tags', () => {
    const input = '<p>hello</p><script>alert("xss")</script>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<script')
    expect(result).toContain('hello')
  })

  it('removes iframe tags', () => {
    const input = '<p>content</p><iframe src="evil.com"></iframe>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<iframe')
    expect(result).toContain('content')
  })

  it('passes through safe HTML', () => {
    const input = '<span>text</span><code>const x = 1;</code><pre>block</pre><br>'
    const result = sanitizeHtml(input)
    expect(result).toContain('<span>')
    expect(result).toContain('<code>')
    expect(result).toContain('<pre>')
    expect(result).toContain('<br')
  })

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
