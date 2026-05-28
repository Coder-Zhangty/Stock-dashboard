const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const fallbackBaseUrls = ['']

const getCandidateBaseUrls = () => {
  const values = [configuredBaseUrl, ...fallbackBaseUrls].filter(
    (value, index, array) => value.length >= 0 && array.indexOf(value) === index,
  )
  return values
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const toErrorMessage = (error: unknown, fallback = 'Request failed.') => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return normalizeApiDetail(error) ?? fallback
}

const normalizeApiDetail = (detail: unknown): string | null => {
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const flattened = detail
      .map((item) => normalizeApiDetail(item))
      .filter((item): item is string => Boolean(item))
    return flattened.length ? flattened.join('\n') : null
  }

  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    if (typeof record.msg === 'string') return record.msg
    if (typeof record.message === 'string') return record.message

    const loc = Array.isArray(record.loc)
      ? record.loc.map((item) => String(item)).join('.')
      : null
    const value =
      normalizeApiDetail(record.detail) ??
      normalizeApiDetail(record.error) ??
      normalizeApiDetail(record.reason)

    if (loc && value) {
      return `${loc}: ${value}`
    }
    if (value) {
      return value
    }

    const entries = Object.entries(record)
      .map(([key, value]) => {
        const next = normalizeApiDetail(value)
        return next ? `${key}: ${next}` : null
      })
      .filter((item): item is string => Boolean(item))

    return entries.length ? entries.join('\n') : null
  }

  return null
}

const toFriendlyNetworkError = (error: unknown) => {
  if (error instanceof ApiError) return error
  if (error instanceof Error && /fetch/i.test(error.message)) {
    return new Error('Cannot reach the API service. Make sure the backend is running.')
  }
  return error instanceof Error ? error : new Error('Request failed.')
}

type RequestOptions = RequestInit & {
  token?: string | null
}

const readCookie = (name: string) => {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

const buildHeaders = (options: RequestOptions) => {
  return new Headers(options.headers)
}

export const getApiBaseUrl = () => configuredBaseUrl

// Simple request dedup: same GET URL within same tick shares the fetch
const _pending = new Map<string, Promise<any>>()

export const requestJson = async <T>(path: string, options: RequestOptions = {}) => {
  const method = options.method || 'GET'

  // Only dedup GET requests (POST/PUT/DELETE have side effects)
  if (method === 'GET') {
    const dupKey = `GET:${path}`
    const pending = _pending.get(dupKey)
    if (pending) {
      try {
        return (await pending) as T
      } catch {
        _pending.delete(dupKey)
      }
    }
  }

  const fetchPromise = _doRequestJson<T>(path, options)
  if (method === 'GET') {
    const dupKey = `GET:${path}`
    _pending.set(dupKey, fetchPromise)
    try {
      const result = await fetchPromise
      return result
    } finally {
      _pending.delete(dupKey)
    }
  }
  return fetchPromise
}

const _doRequestJson = async <T>(path: string, options: RequestOptions = {}) => {
  let lastError: unknown

  for (const baseUrl of getCandidateBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        credentials: 'include',
        headers: buildHeaders(options),
      })

      if (!response.ok) {
        let message = 'Request failed.'
        try {
          const payload = (await response.json()) as { detail?: unknown; message?: unknown }
          message =
            normalizeApiDetail(payload.detail) ??
            normalizeApiDetail(payload.message) ??
            message
        } catch {
          // noop
        }
        throw new ApiError(message, response.status)
      }

      if (response.status === 204) {
        return undefined as T
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      lastError = error
    }
  }

  throw toFriendlyNetworkError(lastError)
}

interface StreamOptions {
  token?: string | null
  signal?: AbortSignal
  onChunk: (chunk: string) => void
  onDone?: (payload: Record<string, string>) => void
  onError?: (message: string) => void
}

export const streamSse = async (
  path: string,
  body: unknown,
  options: StreamOptions,
) => {
  let response: Response | null = null
  let lastError: unknown

  for (const baseUrl of getCandidateBaseUrls()) {
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        signal: options.signal,
        credentials: 'include',
        headers: buildHeaders({
          token: options.token,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        body: JSON.stringify(body),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}.`)
      }

      break
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      lastError = error
      response = null
    }
  }

  if (!response || !response.body) {
    throw toFriendlyNetworkError(lastError)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const rawEvent of events) {
        const lines = rawEvent.split('\n')
        const eventLine = lines.find((line) => line.startsWith('event:'))
        const dataLine = lines.find((line) => line.startsWith('data:'))
        const eventName = eventLine?.replace('event:', '').trim() ?? 'message'
        const data = dataLine?.replace('data:', '').trim()
        if (!data) continue

        const payload = JSON.parse(data) as Record<string, string>

        if (eventName === 'chunk' && payload.delta) {
          options.onChunk(payload.delta)
        }
        if (eventName === 'done') {
          options.onDone?.(payload)
        }
        if (eventName === 'error') {
          options.onError?.(payload.message ?? 'Streaming failed.')
        }
      }
    }
  } finally {
    try {
      reader.cancel()
    } catch {
      // reader already released
    }
  }
}

// ── Convenience wrappers ──

async function get<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function del<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'DELETE' })
}

// ── Market API ──

export const fetchSpotList = (page = 1, page_size = 100, sort_by = '', sort_order = 'desc', filters: Record<string, number> = {}) => {
  const params = new URLSearchParams({ page: String(page), page_size: String(page_size) })
  if (sort_by) { params.set('sort_by', sort_by); params.set('sort_order', sort_order) }
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
  return get<{ total: number; page: number; page_size: number; data: any[] }>(`/api/market/spot?${params.toString()}`)
}
export const fetchQuote = (code: string) => get<any>(`/api/market/quote/${code}`)
export const fetchKLine = (code: string, period = 'daily', count = 120) =>
  get<{ code: string; count: number; data: any[] }>(`/api/market/kline/${code}?period=${period}&count=${count}`)
export const fetchBatchQuotes = (codes: string[]) =>
  get<Record<string, any>>(`/api/market/batch?codes=${codes.join(',')}`)
export const searchStocks = (q: string) => get<any[]>(`/api/market/search?q=${encodeURIComponent(q)}`)
export const fetchMinuteLine = (code: string) => get<any>(`/api/market/minute/${code}`)
export const fetchStockBrief = (code: string) => get<any>(`/api/market/brief/${code}`)
export const fetchIndices = () => get<any[]>('/api/market/index')
export const fetchBreadth = () => get<{ up: number; down: number; flat: number; total: number }>('/api/market/breadth')
export const fetchSectors = (type = 'industry') => get<any[]>(`/api/market/sectors?type=${type}`)

// ── News API ──

export const fetchNews = (limit = 50, offset = 0) => get<any[]>(`/api/news/latest?limit=${limit}&offset=${offset}`)
export const refreshNews = () => post<{ sina: number; total: number }>('/api/news/refresh')
export const searchNews = (q: string) => get<any[]>(`/api/news/search?q=${encodeURIComponent(q)}`)
export const fetchNewsSummary = () => get<{ summary: string; enabled?: boolean; cached?: boolean }>('/api/news/summary')
export const fetchNewsSummaryEnabled = () => get<{ enabled: boolean }>('/api/news/summary/enabled')
export const setNewsSummaryEnabled = (enabled: boolean) => post<{ enabled: boolean }>('/api/news/summary/enabled', { enabled })
export const refreshNewsSummary = () => post<{ summary: string }>('/api/news/summary/refresh')
export const fetchCyqData = (code: string, period = 'daily') =>
  get<import('../types').CyqData>(`/api/market/cyq/${code}?period=${period}`)

export const fetchFundFlow = (code: string, days = 30) => get<any[]>(`/api/market/fundflow/${code}?days=${days}`)
export const fetchMarketTurnover = () => get<{ sh_total: number; sz_total: number; total: number }>('/api/market/market-turnover')
export const fetchNorthboundFlow = () => get<{ sh_net: number; sz_net: number; total_net: number; date: string }>('/api/market/northbound')

// ── HK Market API ──

export const fetchHKQuote = (code: string) => get<{ data: any }>(`/api/market/hk/quote/${code}`)
export const fetchHKBatchQuotes = (codes: string[]) =>
  get<{ data: Record<string, any> }>(`/api/market/hk/batch?codes=${codes.join(',')}`)
export const fetchHKIndices = () => get<{ data: any[] }>('/api/market/hk/indices')
export const fetchHKPopular = () => get<{ data: any[] }>('/api/market/hk/popular')
export const fetchHKSpot = (page = 1, page_size = 100, sort_by = '', sort_order = 'desc', filters: Record<string, number> = {}) => {
  const params = new URLSearchParams({ page: String(page), page_size: String(page_size) })
  if (sort_by) { params.set('sort_by', sort_by); params.set('sort_order', sort_order) }
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
  return get<{ total: number; page: number; page_size: number; data: any[] }>(`/api/market/hk/spot?${params.toString()}`)
}
export const fetchHKKLine = (code: string, period = 'daily', count = 120) =>
  get<{ data: any[] }>(`/api/market/hk/kline/${code}?period=${period}&count=${count}`)

// ── US Market API ──

export const fetchUSQuote = (symbol: string) => get<{ data: any }>(`/api/market/us/quote/${symbol}`)
export const fetchUSBatchQuotes = (symbols: string[]) =>
  get<{ data: Record<string, any> }>(`/api/market/us/batch?symbols=${symbols.join(',')}`)
export const fetchUSIndices = () => get<{ data: any[] }>('/api/market/us/indices')
export const fetchUSPopular = () => get<{ data: any[] }>('/api/market/us/popular')
export const fetchUSKLine = (symbol: string, period = 'daily', count = 120) =>
  get<{ data: any[] }>(`/api/market/us/kline/${symbol}?period=${period}&count=${count}`)
export const fetchUSSpot = (page = 1, page_size = 100, sort_by = '', sort_order = 'desc', filters: Record<string, number> = {}) => {
  const params = new URLSearchParams({ page: String(page), page_size: String(page_size) })
  if (sort_by) { params.set('sort_by', sort_by); params.set('sort_order', sort_order) }
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
  return get<{ total: number; page: number; page_size: number; data: any[] }>(`/api/market/us/spot?${params.toString()}`)
}

export const fetchStockSentiment = (code: string, name: string) =>
  get<{ sentiment: string; summary: string; news: any[] }>(`/api/news/sentiment/${code}?name=${encodeURIComponent(name)}`)

export const fetchExtractedNews = (url: string) =>
  get<{ title: string; content: string; source_url: string }>(`/api/news/extract?url=${encodeURIComponent(url)}`)

// ── Watchlist API ──

export const fetchWatchlist = () => get<any[]>('/api/watchlist')
export const addToWatchlist = (code: string, name: string, market = 'SH') =>
  post<any>('/api/watchlist', { code, name, market })
export const removeFromWatchlist = (code: string) => del<any>(`/api/watchlist/${code}`)
