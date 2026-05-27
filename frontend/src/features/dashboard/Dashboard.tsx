import { useSpotList, useNews, useWatchlist, useWatchlistQuotes, useIndices, useNewsSummary, useBreadth, useMarketTurnover, useNorthboundFlow, useHKIndices, useHKSpotList, useUSIndices, useUSSpotList } from '../../hooks/useMarket'
import { refreshNews, searchStocks, fetchBatchQuotes } from '../../services/api'
import StockList from '../../components/StockList'
import SectorBoard from '../../components/SectorBoard'
import NewsFeed from '../../components/NewsFeed'
import { useToast } from '../../components/Toast'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, X } from 'lucide-react'
import type { NewsItem } from '../../types'
import NewsArticleDrawer from '../../components/NewsArticleDrawer'
import { useI18n } from '../../i18n/I18nProvider'
import { useChatContext } from '../../contexts/ChatContext'
import MarketSwitcher, { type Market } from '../../components/MarketSwitcher'
import { IndicesBar } from './components/IndicesBar'
import { BreadthBar } from './components/BreadthBar'
import { FilterBar } from './components/FilterBar'
import { WatchlistTab } from './components/WatchlistTab'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

interface Props {
  onSelectStock: (code: string) => void
  onLogout: () => void
}

export default function Dashboard({ onSelectStock, onLogout }: Props) {
  const { t } = useI18n()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'market' | 'watchlist' | 'sectors'>('market')
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  const [articleDrawerOpen, setArticleDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [filterChangeMin, setFilterChangeMin] = useState('')
  const [filterChangeMax, setFilterChangeMax] = useState('')
  const [filterVolumeMin, setFilterVolumeMin] = useState('')
  const [filterTurnoverMin, setFilterTurnoverMin] = useState('')
  const [filterTurnoverMax, setFilterTurnoverMax] = useState('')
  const [filterVolumeRatioMin, setFilterVolumeRatioMin] = useState('')
  const [filterVolumeRatioMax, setFilterVolumeRatioMax] = useState('')
  const [filterPeMin, setFilterPeMin] = useState('')
  const [filterPeMax, setFilterPeMax] = useState('')
  const [filterPbMin, setFilterPbMin] = useState('')
  const [filterPbMax, setFilterPbMax] = useState('')
  const [filterAmplitudeMin, setFilterAmplitudeMin] = useState('')
  const [filterAmplitudeMax, setFilterAmplitudeMax] = useState('')
  const [filterMcapMin, setFilterMcapMin] = useState('')
  const [filterMcapMax, setFilterMcapMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const filters: Record<string, number> = {}
  if (filterPriceMin) filters.price_min = Number(filterPriceMin)
  if (filterPriceMax) filters.price_max = Number(filterPriceMax)
  if (filterChangeMin) filters.change_min = Number(filterChangeMin)
  if (filterChangeMax) filters.change_max = Number(filterChangeMax)
  if (filterVolumeMin) filters.volume_min = Number(filterVolumeMin)
  if (filterTurnoverMin) filters.turnover_min = Number(filterTurnoverMin)
  if (filterTurnoverMax) filters.turnover_max = Number(filterTurnoverMax)
  if (filterVolumeRatioMin) filters.volume_ratio_min = Number(filterVolumeRatioMin)
  if (filterVolumeRatioMax) filters.volume_ratio_max = Number(filterVolumeRatioMax)
  if (filterPeMin) filters.pe_min = Number(filterPeMin)
  if (filterPeMax) filters.pe_max = Number(filterPeMax)
  if (filterPbMin) filters.pb_min = Number(filterPbMin)
  if (filterPbMax) filters.pb_max = Number(filterPbMax)
  if (filterAmplitudeMin) filters.amplitude_min = Number(filterAmplitudeMin)
  if (filterAmplitudeMax) filters.amplitude_max = Number(filterAmplitudeMax)
  if (filterMcapMin) filters.mcap_min = Number(filterMcapMin)
  if (filterMcapMax) filters.mcap_max = Number(filterMcapMax)
  const { data: marketData, loading: marketLoading, loadingMore, error: marketError, page, total, pageSize, refresh: refreshMarket, loadPage, loadMore } = useSpotList(sortBy, sortOrder, filters)
  const { data: newsData, loading: newsLoading, loadingMore: newsLoadingMore, refreshing: newsRefreshing, hasMore: newsHasMore, reload: reloadNews, loadMore: loadMoreNews } = useNews()

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }
  const { data: indices, reload: reloadIndices } = useIndices()
  const { data: breadth, reload: reloadBreadth } = useBreadth()
  const { data: turnover } = useMarketTurnover()
  const { data: northbound } = useNorthboundFlow()
  const { data: watchlist, loading: wlLoading, add, remove } = useWatchlist()
  const { quotes: wlQuotes, loading: wlQuotesLoading } = useWatchlistQuotes(watchlist.map((w) => w.code))
  const { summary, enabled: summaryEnabled, refreshing: summaryRefreshing, toggling: summaryToggling, toggle: toggleSummary, refresh: refreshSummary } = useNewsSummary()
  const [searchText, setSearchText] = useState('')
  const { toast } = useToast()
  const { setMarketOverviewData, setMarketContext } = useChatContext()

  // Multi-market support
  const [market, setMarket] = useState<Market>('CN')
  const { data: hkData, loading: hkLoading, loadingMore: hkLoadingMore, error: hkError, page: hkPage, total: hkTotal, refresh: hkRefresh, loadPage: hkLoadPage, loadMore: hkLoadMore } = useHKSpotList(sortBy, sortOrder)
  const { data: hkIndices, reload: hkIndicesReload } = useHKIndices()
  const { data: usData, loading: usLoading, loadingMore: usLoadingMore, error: usError, page: usPage, total: usTotal, refresh: usRefresh, loadPage: usLoadPage, loadMore: usLoadMore } = useUSSpotList(sortBy, sortOrder)
  const { data: usIndices, reload: usIndicesReload } = useUSIndices()

  // draggable splitter
  const [leftWidth, setLeftWidth] = useState(480)
  const dragging = useRef(false)

  const onMouseDown = useCallback(() => { dragging.current = true }, [])
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const w = Math.min(800, Math.max(320, e.clientX))
      setLeftWidth(w)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // backend search
  const [searchData, setSearchData] = useState<any[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    const q = searchText.trim()
    if (!q) {
      setSearchData(null)
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchStocks(q)
        if (results.length === 0) {
          setSearchData([])
          setSearchLoading(false)
          return
        }
        const codes = results.map((r: any) => r.code)
        let quotes: Record<string, any> = {}
        try {
          quotes = await fetchBatchQuotes(codes)
        } catch {
          // batch quotes failed, use empty defaults
        }
        const merged = results.map((r: any) => {
          const q = quotes[r.code] || {}
          return {
            code: r.code,
            name: r.name,
            market: r.market,
            latest_price: q.latest_price ?? 0,
            prev_close: q.prev_close ?? 0,
            change_pct: q.change_pct ?? 0,
            change_amount: q.change_amount ?? 0,
            open: q.open ?? 0,
            high: q.high ?? 0,
            low: q.low ?? 0,
            volume: q.volume ?? 0,
            amount: q.amount ?? 0,
            turnover: q.turnover ?? 0,
          }
        })
        setSearchData(merged)
      } catch {
        setSearchData([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  const displayData = searchData !== null ? searchData : market === 'HK' ? hkData : market === 'US' ? usData : marketData
  const displayLoading = searchText.trim() ? searchLoading : market === 'HK' ? hkLoading : market === 'US' ? usLoading : marketLoading
  const displayLoadingMore = searchText.trim() ? false : market === 'HK' ? hkLoadingMore : market === 'US' ? usLoadingMore : loadingMore
  const displayError = market === 'HK' ? hkError : market === 'US' ? usError : marketError
  const displayPage = market === 'HK' ? hkPage : market === 'US' ? usPage : page
  const displayTotal = market === 'HK' ? hkTotal : market === 'US' ? usTotal : total
  const handleLoadPage = market === 'HK' ? hkLoadPage : market === 'US' ? usLoadPage : loadPage
  const handleLoadMore = market === 'HK' ? hkLoadMore : market === 'US' ? usLoadMore : loadMore
  const handleRefresh = market === 'HK' ? hkRefresh : market === 'US' ? usRefresh : refreshMarket
  const currentIndices = market === 'HK' ? hkIndices : market === 'US' ? usIndices : indices

  const handleAddToWatchlist = async (code: string, name: string, market: string) => {
    await add(code, name, market)
    toast(t('dashboard.watchlist.added').replace('{code}', code).replace('{name}', name), 'success')
  }

  const [newsRefreshLoading, setNewsRefreshLoading] = useState(false)
  const handleRefreshNews = async () => {
    setNewsRefreshLoading(true)
    try {
      const result = await refreshNews()
      toast(t('dashboard.news.refreshSuccess').replace('{total}', String(result.total)), 'success')
      await reloadNews()
    } catch {
      toast(t('dashboard.news.refreshError'), 'error')
    } finally {
      setNewsRefreshLoading(false)
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const marketScrollRef = useRef<HTMLDivElement>(null)

  const handleMarketScroll = useCallback(() => {
    if (searchText.trim()) return
    const el = marketScrollRef.current
    if (!el || displayLoadingMore) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 80) {
      handleLoadMore()
    }
  }, [handleLoadMore, displayLoadingMore, searchText])

  // Poll indices and breadth every 60s
  useEffect(() => {
    const id = setInterval(() => {
      if (market === 'CN') {
        reloadIndices()
        reloadBreadth()
      } else if (market === 'HK') {
        hkIndicesReload()
      } else if (market === 'US') {
        usIndicesReload()
      }
    }, 60000)
    return () => clearInterval(id)
  }, [market, reloadIndices, reloadBreadth, hkIndicesReload, usIndicesReload])

  // Poll news every 60s
  useEffect(() => {
    const id = setInterval(() => {
      reloadNews()
    }, 60000)
    return () => clearInterval(id)
  }, [reloadNews])

  const [summaryInterval, setSummaryInterval] = useState(0) // minutes, 0 = off

  // Clear stock context on mount (back from StockDetail)
  useEffect(() => {
    setMarketContext({ type: 'none', label: '', data: null })
  }, [setMarketContext])

  // Push market overview data to chat context for AI context
  useEffect(() => {
    if (market === 'CN' && indices.length > 0) {
      setMarketOverviewData({ indices, breadth, turnover, northbound })
    } else if (market === 'HK' && hkIndices.length > 0) {
      setMarketOverviewData({ indices: hkIndices, breadth: { up: 0, down: 0, flat: 0, total: 0 } })
    } else if (market === 'US' && usIndices.length > 0) {
      setMarketOverviewData({ indices: usIndices, breadth: { up: 0, down: 0, flat: 0, total: 0 } })
    }
  }, [market, indices, breadth, turnover, northbound, hkIndices, usIndices, setMarketOverviewData])

  // Auto-refresh AI summary based on selected interval
  useEffect(() => {
    if (!summaryEnabled || summaryInterval <= 0) return
    const id = setInterval(() => {
      refreshSummary()
    }, summaryInterval * 60000)
    return () => clearInterval(id)
  }, [summaryEnabled, summaryInterval, refreshSummary])

  return (
    <div className="flex flex-col h-full">
      {/* Market switcher + indices */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border-color bg-bg-secondary">
        <MarketSwitcher current={market} onChange={setMarket} />
        {market === 'CN' && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IndicesBar indices={indices} />
            <BreadthBar breadth={breadth} />
          </div>
        )}
        {(market === 'HK' || market === 'US') && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IndicesBar indices={currentIndices} />
          </div>
        )}
      </div>
      <div className={`flex flex-1 min-h-0 ${isMobile ? 'flex-col' : ''}`}>
      <div className={`shrink-0 flex flex-col ${isMobile ? 'max-h-[55vh] border-b border-border-color' : 'border-r border-border-color'}`} style={isMobile ? undefined : { width: leftWidth }}>
        {/* Search bar — A-share only */}
        {market === 'CN' && (
        <div className="p-3 border-b border-border-color">
          <div className="relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('dashboard.search.placeholder')}
              className="w-full bg-bg-primary border border-border-color rounded px-3 py-1.5 text-xs
                         text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue pr-7"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        )}

        {/* Filter bar — A-share only */}
        {tab === 'market' && market === 'CN' && (
          <FilterBar
            showFilters={showFilters}
            onToggle={() => setShowFilters(!showFilters)}
            filterCount={Object.keys(filters).length}
            filterPriceMin={filterPriceMin}
            filterPriceMax={filterPriceMax}
            filterChangeMin={filterChangeMin}
            filterChangeMax={filterChangeMax}
            filterVolumeMin={filterVolumeMin}
            filterTurnoverMin={filterTurnoverMin}
            filterTurnoverMax={filterTurnoverMax}
            filterVolumeRatioMin={filterVolumeRatioMin}
            filterVolumeRatioMax={filterVolumeRatioMax}
            filterPeMin={filterPeMin}
            filterPeMax={filterPeMax}
            filterPbMin={filterPbMin}
            filterPbMax={filterPbMax}
            filterAmplitudeMin={filterAmplitudeMin}
            filterAmplitudeMax={filterAmplitudeMax}
            filterMcapMin={filterMcapMin}
            filterMcapMax={filterMcapMax}
            onPriceMinChange={setFilterPriceMin}
            onPriceMaxChange={setFilterPriceMax}
            onChangeMinChange={setFilterChangeMin}
            onChangeMaxChange={setFilterChangeMax}
            onVolumeMinChange={setFilterVolumeMin}
            onTurnoverMinChange={setFilterTurnoverMin}
            onTurnoverMaxChange={setFilterTurnoverMax}
            onVolumeRatioMinChange={setFilterVolumeRatioMin}
            onVolumeRatioMaxChange={setFilterVolumeRatioMax}
            onPeMinChange={setFilterPeMin}
            onPeMaxChange={setFilterPeMax}
            onPbMinChange={setFilterPbMin}
            onPbMaxChange={setFilterPbMax}
            onAmplitudeMinChange={setFilterAmplitudeMin}
            onAmplitudeMaxChange={setFilterAmplitudeMax}
            onMcapMinChange={setFilterMcapMin}
            onMcapMaxChange={setFilterMcapMax}
            onClear={() => {
              setFilterPriceMin(''); setFilterPriceMax(''); setFilterChangeMin('')
              setFilterChangeMax(''); setFilterVolumeMin('')
              setFilterTurnoverMin(''); setFilterTurnoverMax('')
              setFilterVolumeRatioMin(''); setFilterVolumeRatioMax('')
              setFilterPeMin(''); setFilterPeMax('')
              setFilterPbMin(''); setFilterPbMax('')
              setFilterAmplitudeMin(''); setFilterAmplitudeMax('')
              setFilterMcapMin(''); setFilterMcapMax('')
            }}
          />
        )}

        {/* Tabs */}
        <div className="flex border-b border-border-color bg-bg-secondary">
          <button
            className={`flex-1 py-2 text-xs font-medium ${tab === 'market' ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-text-secondary'}`}
            onClick={() => setTab('market')}
          >
            {t('dashboard.tab.market')}
          </button>
          <button
            className={`flex-1 py-2 text-xs font-medium ${tab === 'watchlist' ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-text-secondary'}`}
            onClick={() => setTab('watchlist')}
          >
            {t('dashboard.tab.watchlist')} ({watchlist.length})
          </button>
          <button
            className={`flex-1 py-2 text-xs font-medium ${tab === 'sectors' ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-text-secondary'}`}
            onClick={() => setTab('sectors')}
          >
            {t('dashboard.tab.sectors')}
          </button>
        </div>

        <div
          className="flex-1 overflow-auto min-h-0"
          ref={marketScrollRef}
          onScroll={handleMarketScroll}
        >
          {tab === 'market' ? (
            <>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[10px] text-text-secondary">
                  {displayError ? t('dashboard.market.loadError') : searchText.trim() ? t('dashboard.market.searchResult').replace('{count}', String(displayData.length)) : t('dashboard.market.pageInfo').replace('{page}', String(displayPage)).replace('{total}', String(displayTotal))}
                </span>
                {!searchText.trim() && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleLoadPage(displayPage - 1)}
                    disabled={displayPage <= 1}
                    className="text-text-secondary hover:text-text-primary p-0.5 disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => handleLoadPage(displayPage + 1)}
                    disabled={displayPage * pageSize >= displayTotal}
                    className="text-text-secondary hover:text-text-primary p-0.5 disabled:opacity-30"
                  >
                    ›
                  </button>
                  <button onClick={handleRefresh} className="text-text-secondary hover:text-text-primary p-1" title={t('dashboard.market.refresh')}>
                    <RefreshCw size={14} />
                  </button>
                </div>
                )}
              </div>
              {market === 'CN' && !searchText.trim() && (
              <div className="flex gap-1 px-3 py-1 border-b border-border-color">
                {[
                  { label: t('dashboard.ranking.gainers'), by: 'change_pct', order: 'desc' },
                  { label: t('dashboard.ranking.losers'), by: 'change_pct', order: 'asc' },
                  { label: t('dashboard.ranking.amount'), by: 'amount', order: 'desc' },
                  { label: t('dashboard.ranking.turnover'), by: 'turnover', order: 'desc' },
                ].map((rk) => (
                  <button
                    key={rk.label}
                    onClick={() => { setSortBy(rk.by); setSortOrder(rk.order) }}
                    className={`px-2 py-0.5 text-[10px] rounded ${
                      sortBy === rk.by && sortOrder === rk.order
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:text-text-primary bg-bg-primary'
                    }`}
                  >
                    {rk.label}
                  </button>
                ))}
              </div>
              )}
              {(market === 'HK' || market === 'US') && !searchText.trim() && (
              <div className="flex gap-1 px-3 py-1 border-b border-border-color">
                {[
                  { label: t('dashboard.ranking.gainers'), by: 'change_pct', order: 'desc' },
                  { label: t('dashboard.ranking.losers'), by: 'change_pct', order: 'asc' },
                ].map((rk) => (
                  <button
                    key={rk.label}
                    onClick={() => { setSortBy(rk.by); setSortOrder(rk.order) }}
                    className={`px-2 py-0.5 text-[10px] rounded ${
                      sortBy === rk.by && sortOrder === rk.order
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:text-text-primary bg-bg-primary'
                    }`}
                  >
                    {rk.label}
                  </button>
                ))}
              </div>
              )}
              <StockList data={displayData} loading={displayLoading} loadingMore={displayLoadingMore} onSelect={onSelectStock} onAddWatchlist={handleAddToWatchlist} sortBy={market === 'CN' ? sortBy : 'change_pct'} sortOrder={market === 'CN' ? sortOrder : 'desc'} onSort={handleSort} />
            </>
          ) : tab === 'watchlist' ? (
            <WatchlistTab
              watchlist={watchlist}
              loading={wlLoading}
              quotes={wlQuotes}
              onSelect={onSelectStock}
              onRemove={remove}
            />
          ) : (
            <SectorBoard onSelectStock={onSelectStock} />
          )}
        </div>
      </div>

      {/* Drag handle - hidden on mobile */}
      {!isMobile && (
        <div
          onMouseDown={onMouseDown}
          className="w-1 shrink-0 bg-border-color hover:bg-accent-blue cursor-col-resize transition-colors"
        />
      )}

      {/* Right panel with tabs */}
      <div className={`flex-1 flex flex-col min-w-0 ${isMobile ? 'border-t border-border-color min-h-[40vh]' : ''}`}>
        <div className="flex border-b border-border-color bg-bg-secondary">
          <span className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-accent-blue text-center">
            {t('dashboard.tab.news')}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border-color bg-bg-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={handleRefreshNews} disabled={newsRefreshLoading} className="text-text-secondary hover:text-text-primary p-1 disabled:opacity-50" title={t('dashboard.news.refresh')}>
                  <RefreshCw size={14} className={newsRefreshLoading ? 'animate-spin' : ''} />
                </button>
                {newsRefreshLoading && <span className="text-[10px] text-text-secondary animate-pulse">{t('dashboard.news.fetchingNews')}</span>}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-1">
              <div className="mx-2 mb-2 p-3 rounded bg-accent-blue/10 border border-accent-blue/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[10px] font-semibold text-accent-blue uppercase tracking-wider">{t('dashboard.news.aiSummary')}</h3>
                    <div className="flex items-center gap-2">
                      {summaryEnabled && (
                        <>
                          <span className="text-[9px] text-white/30 mr-0.5">{t('dashboard.news.autoRefresh')}</span>
                          <div className="flex items-center gap-0.5">
                            {[0, 1, 5, 10, 30].map((min) => (
                              <button
                                key={min}
                                onClick={() => setSummaryInterval(min)}
                                className={`px-1.5 py-0.5 text-[9px] rounded transition ${
                                  summaryInterval === min
                                    ? 'bg-accent-blue text-white'
                                    : 'text-white/40 hover:text-white/70'
                                }`}
                              >
                                {min === 0 ? t('dashboard.news.intervalOff') : t('dashboard.news.intervalMin').replace('{n}', String(min))}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={refreshSummary}
                            disabled={summaryRefreshing}
                            className="text-text-secondary hover:text-text-primary p-0.5 disabled:opacity-50"
                            title={t('dashboard.news.refresh')}
                          >
                            <RefreshCw size={12} className={summaryRefreshing ? 'animate-spin' : ''} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={toggleSummary}
                        disabled={summaryToggling}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          summaryEnabled ? 'bg-accent-blue' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            summaryEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  {summaryEnabled && summary && (
                    <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{summary}</div>
                  )}
                  {summaryEnabled && !summary && summaryRefreshing && (
                    <div className="text-xs text-text-secondary animate-pulse">{t('dashboard.news.generatingSummary')}</div>
                  )}
                  {summaryEnabled && !summary && !summaryRefreshing && (
                    <div className="text-xs text-text-secondary">{t('dashboard.news.noSummary')}</div>
                  )}
                </div>
              <NewsFeed
                data={newsData}
                loading={newsLoading}
                loadingMore={newsLoadingMore}
                hasMore={newsHasMore}
                onLoadMore={loadMoreNews}
                onSelectArticle={(item) => { setSelectedArticle(item); setArticleDrawerOpen(true) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <NewsArticleDrawer
      open={articleDrawerOpen}
      article={selectedArticle}
      onClose={() => setArticleDrawerOpen(false)}
    />
    </div>
  )
}
