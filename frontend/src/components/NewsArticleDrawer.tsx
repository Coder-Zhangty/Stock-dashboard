import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, Globe, FileText, Link2, Loader2, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import type { NewsItem, ArticleViewMode } from '../types'
import { fetchExtractedNews } from '../services/api'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { getApiBaseUrl } from '../services/api'

interface Props {
  open: boolean
  article: NewsItem | null
  onClose: () => void
}

const sourceNames: Record<string, string> = {
  sina: '新浪财经',
  eastmoney: '东方财富',
  cls: '财联社',
}

const MODES: { key: ArticleViewMode; label: string; icon: typeof Globe }[] = [
  { key: 'proxy', label: '代理浏览', icon: Globe },
  { key: 'extract', label: '纯净阅读', icon: FileText },
  { key: 'direct', label: '直接加载', icon: Link2 },
]

export default function NewsArticleDrawer({ open, article, onClose }: Props) {
  const [mode, setMode] = useState<ArticleViewMode>('proxy')
  const [extractedContent, setExtractedContent] = useState('')
  const [extractedTitle, setExtractedTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && article) {
      setMode('proxy')
      setExtractedContent('')
      setExtractedTitle('')
      setError(null)
      setLoading(false)
    }
  }, [open, article])

  const loadExtracted = useCallback(async () => {
    if (!article) return
    if (extractedContent && extractedTitle) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const result = await fetchExtractedNews(article.url)
      if (!controller.signal.aborted) {
        setExtractedTitle(result.title)
        setExtractedContent(result.content)
        setLoading(false)
      }
    } catch (e: any) {
      if (!controller.signal.aborted) {
        setError(e?.message || '提取失败，请重试')
        setLoading(false)
      }
    }
  }, [article, extractedContent, extractedTitle])

  useEffect(() => {
    if (mode === 'extract' && open) {
      loadExtracted()
    }
  }, [mode, open, loadExtracted])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  if (!article) return null

  const proxyUrl = `${getApiBaseUrl()}/api/news/proxy?url=${encodeURIComponent(article.url)}`

  return (
    <div
      className={clsx(
        'fixed inset-0 z-40 transition duration-300',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-black/50 transition duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'absolute right-0 top-0 h-full w-full max-w-[720px] flex flex-col',
          'bg-bg-primary border-l border-white/10 shadow-2xl',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white/90 truncate pr-4">
            {article.title}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode switcher */}
        <div className="shrink-0 flex gap-1 px-5 py-3 border-b border-white/10">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition',
                mode === key
                  ? 'bg-accent-blue text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {(mode === 'proxy' || mode === 'direct') && (
            <iframe
              src={mode === 'proxy' ? proxyUrl : article.url}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
              title={article.title}
            />
          )}

          {mode === 'extract' && (
            <div className="h-full overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/40">
                  <Loader2 size={28} className="animate-spin" />
                  <span className="text-xs">正在提取文章内容...</span>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center h-64 gap-3 px-6">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle size={18} />
                    <span className="text-sm">{error}</span>
                  </div>
                  <button
                    onClick={() => { setError(null); setExtractedContent(''); setExtractedTitle(''); }}
                    className="px-4 py-1.5 rounded text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/80 transition"
                  >
                    重试
                  </button>
                </div>
              )}

              {!loading && !error && extractedContent && (
                <div className="p-6">
                  {extractedTitle && (
                    <h1 className="text-lg font-bold text-white/90 mb-4 leading-relaxed">
                      {extractedTitle}
                    </h1>
                  )}
                  <div
                    className="article-content text-sm leading-relaxed text-white/80"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(extractedContent) }}
                  />
                </div>
              )}

              {!loading && !error && !extractedContent && (
                <div className="flex items-center justify-center h-64 text-white/30 text-xs">
                  请点击上方"纯净阅读"按钮加载文章
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-white/10">
          <span className="text-[11px] text-white/30 truncate max-w-[400px]">
            {sourceNames[article.source] || article.source} · {article.published_at}
          </span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 transition"
          >
            <ExternalLink size={13} />
            查看原文
          </a>
        </div>
      </aside>

      {/* Article content styles */}
      <style>{`
        .article-content p { margin-bottom: 1em; }
        .article-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.75em 0; }
        .article-content a { color: rgb(var(--db-accent-light)); text-decoration: underline; }
        .article-content blockquote { border-left: 3px solid rgb(var(--db-accent)); padding-left: 1em; margin: 0.75em 0; color: #94a3b8; }
        .article-content h1, .article-content h2, .article-content h3 { font-weight: 600; margin: 1.25em 0 0.5em; color: rgb(var(--db-text)); }
        .article-content h2 { font-size: 1.1em; }
        .article-content h3 { font-size: 1em; }
        .article-content ul, .article-content ol { padding-left: 1.5em; margin-bottom: 1em; }
        .article-content li { margin-bottom: 0.25em; }
        .article-content table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        .article-content td, .article-content th { border: 1px solid #374151; padding: 0.5em 0.75em; text-align: left; }
        .article-content pre { background: #1e293b; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 0.75em 0; }
        .article-content code { font-size: 0.875em; background: #1e293b; padding: 0.15em 0.35em; border-radius: 3px; }
        .article-content pre code { background: none; padding: 0; }
      `}</style>
    </div>
  )
}
