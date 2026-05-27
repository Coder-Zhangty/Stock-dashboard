import { useRef, useCallback, useEffect } from 'react'
import type { NewsItem } from '../types'
import { useI18n } from '../i18n/I18nProvider'
import { SkeletonNewsList } from './common/Skeleton'

interface Props {
  data: NewsItem[]
  loading: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onSelectArticle?: (item: NewsItem) => void
}

const sourceColors: Record<string, string> = {
  sina: 'text-orange-400',
  cls: 'text-orange-400',
  eastmoney: 'text-blue-400',
}

export default function NewsFeed({ data, loading, loadingMore, hasMore, onLoadMore, onSelectArticle }: Props) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)

  const sourceNames: Record<string, string> = {
    sina: t('dashboard.news.source.sina'),
    eastmoney: t('dashboard.news.source.eastmoney'),
    cls: t('dashboard.news.source.cls'),
  }

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !onLoadMore || !hasMore || loadingMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      onLoadMore()
    }
  }, [onLoadMore, hasMore, loadingMore])

  if (loading) {
    return <SkeletonNewsList count={10} />
  }
  return (
    <div ref={scrollRef} onScroll={handleScroll} className="space-y-2 max-h-full overflow-auto">
      {data.map((item) => (
        <a
          key={item.id}
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (onSelectArticle) {
              e.preventDefault()
              onSelectArticle(item)
            }
          }}
          className="block px-3 py-2 rounded hover:bg-bg-card transition-colors border border-transparent hover:border-border-color cursor-pointer"
        >
          <div className="flex items-start gap-2">
            <span className={`text-[10px] font-medium shrink-0 mt-0.5 ${sourceColors[item.source] || 'text-text-secondary'}`}>
              [{sourceNames[item.source] || item.source}]
            </span>
            <p className="text-xs leading-relaxed text-text-primary/90 line-clamp-2">
              {item.title}
            </p>
          </div>
          <span className="text-[10px] text-text-secondary mt-1 block">{item.published_at}</span>
        </a>
      ))}
      {loadingMore && (
        <div className="py-3 flex justify-center">
          <span className="text-xs text-text-secondary">{t('dashboard.news.loadingMore')}</span>
        </div>
      )}
      {!hasMore && data.length > 0 && (
        <div className="py-3 flex justify-center">
          <span className="text-[10px] text-text-secondary">{t('dashboard.news.noMore')}</span>
        </div>
      )}
    </div>
  )
}
