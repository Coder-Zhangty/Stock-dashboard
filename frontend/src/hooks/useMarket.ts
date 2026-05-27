import { useState, useEffect, useCallback } from 'react'
import type { StockQuote, KLineItem, NewsItem, WatchlistItem, StockSearchResult, StockBrief, MinuteBar, FundFlowItem, CyqData, IndexItem, SentimentResult } from '../types'
import {
  fetchSpotList,
  fetchQuote,
  fetchKLine,
  fetchNews,
  fetchWatchlist,
  fetchBatchQuotes,
  addToWatchlist as apiAddWatchlist,
  removeFromWatchlist as apiRemoveWatchlist,
  searchStocks,
  fetchStockBrief,
  fetchIndices,
  fetchBreadth,
  fetchNewsSummary,
  fetchNewsSummaryEnabled,
  setNewsSummaryEnabled,
  refreshNewsSummary,
  fetchStockSentiment,
  fetchMinuteLine,
  fetchFundFlow,
  fetchCyqData,
  fetchMarketTurnover,
  fetchNorthboundFlow,
  fetchHKQuote,
  fetchHKBatchQuotes,
  fetchHKIndices,
  fetchHKPopular,
  fetchUSQuote,
  fetchUSBatchQuotes,
  fetchUSIndices,
  fetchUSPopular,
  fetchHKKLine,
  fetchUSKLine,
  fetchHKSpot,
  fetchUSSpot,
} from '../services/api'

export function useSpotList(sortBy = '', sortOrder = 'desc', filters: Record<string, number> = {}) {
  const [data, setData] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 100

  const loadPage = useCallback(async (p: number) => {
    setError(null)
    try {
      const res = await fetchSpotList(p, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [sortBy, sortOrder, JSON.stringify(filters)])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1
    if ((nextPage - 1) * pageSize >= total) return
    setLoadingMore(true)
    try {
      const res = await fetchSpotList(nextPage, pageSize, sortBy, sortOrder, filters)
      setData(prev => [...prev, ...(res.data || [])])
      setTotal(res.total || 0)
      setPage(nextPage)
    } catch {
      // silent on load more
    } finally {
      setLoadingMore(false)
    }
  }, [page, total, loadingMore, sortBy, sortOrder, JSON.stringify(filters)])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchSpotList(page, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [page, sortBy, sortOrder, JSON.stringify(filters)])

  // Incremental price update: only sync prices, keep list order/position
  const updatePrices = useCallback(async () => {
    if (data.length === 0) return
    try {
      const codes = data.map((s: StockQuote) => s.code)
      const quotes = await fetchBatchQuotes(codes)
      if (Object.keys(quotes).length === 0) return
      setData((prev: StockQuote[]) => prev.map((s: StockQuote) => {
        const q = quotes[s.code]
        if (!q) return s
        return { ...s, latest_price: q.latest_price ?? s.latest_price, change_pct: q.change_pct ?? s.change_pct, volume: q.volume ?? s.volume, amount: q.amount ?? s.amount }
      }))
    } catch {
      // silent on incremental update
    }
  }, [data.length])

  useEffect(() => {
    loadPage(1).then(() => setLoading(false))
  }, [loadPage])

  return { data, loading, loadingMore, error, page, total, pageSize, refresh, updatePrices, loadPage, loadMore }
}

export function useStockQuote(code: string | null) {
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    setError(null)

    const load = async (isPoll: boolean) => {
      try {
        const data = await fetchQuote(code)
        if (!active || data.error) return
        setQuote(data)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '获取报价失败')
      } finally {
        if (active && !isPoll) setLoading(false)
      }
    }

    load(false)
    const interval = setInterval(() => load(true), 5000)
    return () => { active = false; clearInterval(interval) }
  }, [code])

  return { quote, loading, error }
}

export function useKLine(code: string | null, period = 'daily') {
  const [data, setData] = useState<KLineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    setError(null)
    fetchKLine(code, period).then((res) => {
      if (active) setData(res.data || [])
      if (active) setLoading(false)
    }).catch((e) => {
      if (active) setError(e instanceof Error ? e.message : '获取K线失败')
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code, period])

  return { data, loading, error }
}

export function useNews() {
  const [data, setData] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetchNews(50, 0)
      setData(res || [])
      setHasMore((res || []).length >= 50)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取新闻失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetchNews(50, data.length)
      if (res && res.length > 0) {
        setData(prev => [...prev, ...res])
        setHasMore(res.length >= 50)
      } else {
        setHasMore(false)
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }, [data.length, loadingMore, hasMore])

  useEffect(() => { load() }, [load])

  const silentReload = useCallback(async () => {
    setRefreshing(true)
    try {
      await load(true)
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return { data, loading, loadingMore, refreshing, hasMore, error, reload: silentReload, loadMore }
}

export function useWatchlist() {
  const [data, setData] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWatchlist()
      setData(res || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取自选股失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async (code: string, name: string, market = 'SH') => {
    await apiAddWatchlist(code, name, market)
    load()
  }

  const remove = async (code: string) => {
    await apiRemoveWatchlist(code)
    load()
  }

  return { data, loading, error, add, remove, reload: load }
}

export function useWatchlistQuotes(codes: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Partial<StockQuote>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!codes.length) {
      setQuotes({})
      return
    }
    let active = true
    setLoading(true)
    fetchBatchQuotes(codes).then((data) => {
      if (active) setQuotes(data || {})
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [codes.join(',')])

  return { quotes, loading }
}

export function useStockBrief(code: string | null) {
  const [brief, setBrief] = useState<StockBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    setError(null)
    fetchStockBrief(code).then((data) => {
      if (active) setBrief(data)
      if (active) setLoading(false)
    }).catch((e) => {
      if (active) setError(e instanceof Error ? e.message : '获取基本面失败')
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code])

  return { brief, loading, error }
}

export function useStockSearch() {
  const [results, setResults] = useState<StockSearchResult[]>([])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }
    try {
      const res = await searchStocks(query)
      setResults(res || [])
    } catch {
      setResults([])
    }
  }, [])

  return { results, search, clear: () => setResults([]) }
}

export function useIndices() {
  const [data, setData] = useState<IndexItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchIndices()
      setData(res || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, reload: load }
}

export function useBreadth() {
  const [data, setData] = useState<{ up: number; down: number; flat: number; total: number }>({ up: 0, down: 0, flat: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchBreadth()
      setData(res || { up: 0, down: 0, flat: 0, total: 0 })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, reload: load }
}

export function useMarketTurnover() {
  const [data, setData] = useState<{ sh_total: number; sz_total: number; total: number }>({ sh_total: 0, sz_total: 0, total: 0 })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetchMarketTurnover()
        if (active) setData(res || { sh_total: 0, sz_total: 0, total: 0 })
      } catch { /* silent */ }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return { data }
}

export function useNorthboundFlow() {
  const [data, setData] = useState<{ sh_net: number; sz_net: number; total_net: number; date: string }>({ sh_net: 0, sz_net: 0, total_net: 0, date: '' })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetchNorthboundFlow()
        if (active) setData(res || { sh_net: 0, sz_net: 0, total_net: 0, date: '' })
      } catch { /* silent */ }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return { data }
}

export function useNewsSummary() {
  const [summary, setSummary] = useState<string>('')
  const [enabled, setEnabled] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const enabledRes = await fetchNewsSummaryEnabled()
      setEnabled(enabledRes.enabled)
      if (!enabledRes.enabled) { setLoading(false); return }
      const res = await fetchNewsSummary()
      setSummary(res.summary || '')
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async () => {
    setToggling(true)
    try {
      const res = await setNewsSummaryEnabled(!enabled)
      setEnabled(res.enabled)
      if (res.enabled) {
        const summaryRes = await fetchNewsSummary()
        setSummary(summaryRes.summary || '')
      } else {
        setSummary('')
      }
    } catch {
      // silent
    } finally {
      setToggling(false)
    }
  }, [enabled])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await refreshNewsSummary()
      setSummary(res.summary || '')
    } catch {
      // silent
    } finally {
      setRefreshing(false)
    }
  }, [])

  return { summary, enabled, loading, refreshing, toggling, reload: load, toggle, refresh }
}

export function useStockSentiment(code: string | null, name: string) {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code || !name) return
    let active = true
    setLoading(true)
    fetchStockSentiment(code, name).then((data) => {
      if (active) setSentiment(data)
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code, name])

  return { sentiment, loading }
}

export function useMinuteLine(code: string | null) {
  const [data, setData] = useState<MinuteBar[]>([])
  const [prevClose, setPrevClose] = useState(0)
  const [minuteDate, setMinuteDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)

    const load = async (isPoll: boolean) => {
      try {
        const res = await fetchMinuteLine(code)
        if (!active) return
        setData(res.data || [])
        setPrevClose(res.prev_close || 0)
        setMinuteDate(res.date || '')
      } catch {
        // silent on poll errors
      } finally {
        if (active && !isPoll) setLoading(false)
      }
    }

    load(false)
    const interval = setInterval(() => load(true), 1000)
    return () => { active = false; clearInterval(interval) }
  }, [code])

  return { data, prevClose, minuteDate, loading }
}

export function useFundFlow(code: string | null) {
  const [data, setData] = useState<FundFlowItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    fetchFundFlow(code).then((res) => {
      if (active) setData(res || [])
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code])

  return { data, loading }
}

export function useCyqData(code: string | null, period = 'daily') {
  const [data, setData] = useState<CyqData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    fetchCyqData(code, period).then((res) => {
      if (active) setData(res)
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code, period])

  return { data, loading }
}

// ── HK Market Hooks ──

export function useHKPopular() {
  const [data, setData] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchHKPopular().then((res) => {
      if (active) setData(res?.data ?? [])
    }).catch(() => {}).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { data, loading }
}

export function useHKIndices() {
  const [data, setData] = useState<IndexItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchHKIndices()
      setData(res?.data ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, reload: load }
}

export function useHKQuote(code: string | null) {
  const [data, setData] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    fetchHKQuote(code).then((res) => {
      if (active) setData(res?.data ?? null)
    }).catch(() => {
      if (active) setData(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    const interval = setInterval(async () => {
      try {
        const res = await fetchHKQuote(code)
        if (active) setData(res?.data ?? null)
      } catch { /* poll silently */ }
    }, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [code])

  return { data, loading }
}

// ── US Market Hooks ──

export function useUSPopular() {
  const [data, setData] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchUSPopular().then((res) => {
      if (active) setData(res?.data ?? [])
    }).catch(() => {}).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { data, loading }
}

export function useUSIndices() {
  const [data, setData] = useState<IndexItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchUSIndices()
      setData(res?.data ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, reload: load }
}

export function useUSQuote(symbol: string | null) {
  const [data, setData] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    let active = true
    setLoading(true)
    fetchUSQuote(symbol).then((res) => {
      if (active) setData(res?.data ?? null)
    }).catch(() => {
      if (active) setData(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    const interval = setInterval(async () => {
      try {
        const res = await fetchUSQuote(symbol)
        if (active) setData(res?.data ?? null)
      } catch { /* poll silently */ }
    }, 10000)
    return () => { active = false; clearInterval(interval) }
  }, [symbol])

  return { data, loading }
}

export function useHKSpotList(sortBy = '', sortOrder = 'desc', filters: Record<string, number> = {}) {
  const [data, setData] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 100

  const loadPage = useCallback(async (p: number) => {
    setError(null)
    try {
      const res = await fetchHKSpot(p, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [sortBy, sortOrder, JSON.stringify(filters)])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1
    if ((nextPage - 1) * pageSize >= total) return
    setLoadingMore(true)
    try {
      const res = await fetchHKSpot(nextPage, pageSize, sortBy, sortOrder, filters)
      setData(prev => [...prev, ...(res.data || [])])
      setTotal(res.total || 0)
      setPage(nextPage)
    } catch {
      // silent on load more
    } finally {
      setLoadingMore(false)
    }
  }, [page, total, loadingMore, sortBy, sortOrder, JSON.stringify(filters)])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchHKSpot(page, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [page, sortBy, sortOrder, JSON.stringify(filters)])

  useEffect(() => {
    loadPage(1).then(() => setLoading(false))
  }, [loadPage])

  return { data, loading, loadingMore, error, page, total, pageSize, refresh, loadPage, loadMore }
}

export function useUSSpotList(sortBy = '', sortOrder = 'desc', filters: Record<string, number> = {}) {
  const [data, setData] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 100

  const loadPage = useCallback(async (p: number) => {
    setError(null)
    try {
      const res = await fetchUSSpot(p, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [sortBy, sortOrder, JSON.stringify(filters)])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1
    if ((nextPage - 1) * pageSize >= total) return
    setLoadingMore(true)
    try {
      const res = await fetchUSSpot(nextPage, pageSize, sortBy, sortOrder, filters)
      setData(prev => [...prev, ...(res.data || [])])
      setTotal(res.total || 0)
      setPage(nextPage)
    } catch {
      // silent on load more
    } finally {
      setLoadingMore(false)
    }
  }, [page, total, loadingMore, sortBy, sortOrder, JSON.stringify(filters)])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchUSSpot(page, pageSize, sortBy, sortOrder, filters)
      setData(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取行情失败')
    }
  }, [page, sortBy, sortOrder, JSON.stringify(filters)])

  useEffect(() => {
    loadPage(1).then(() => setLoading(false))
  }, [loadPage])

  return { data, loading, loadingMore, error, page, total, pageSize, refresh, loadPage, loadMore }
}

// ── Cross-market K-line hooks ──

export function useHKKLine(code: string | null, period = 'daily') {
  const [data, setData] = useState<KLineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    setError(null)
    fetchHKKLine(code, period).then((res) => {
      if (active) setData(res?.data ?? [])
    }).catch((err) => {
      if (active) setError(err?.message ?? 'Failed to load')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [code, period])

  return { data, loading, error }
}

export function useUSKLine(symbol: string | null, period = 'daily') {
  const [data, setData] = useState<KLineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    let active = true
    setLoading(true)
    setError(null)
    fetchUSKLine(symbol, period).then((res) => {
      if (active) setData(res?.data ?? [])
    }).catch((err) => {
      if (active) setError(err?.message ?? 'Failed to load')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [symbol, period])

  return { data, loading, error }
}
