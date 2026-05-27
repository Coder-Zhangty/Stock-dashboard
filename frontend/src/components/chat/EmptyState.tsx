import { useCallback } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { loadPresetPrompts } from '../../lib/presetPrompts'

const supportCopy = {
  'zh-CN': '选中一只股票点击"与 AI 讨论"，我将基于实时行情数据为您提供专业的技术分析、资金面解读和风险评估。',
  'en-US': 'Select a stock and click "Discuss with AI" — I\'ll provide professional technical analysis, capital flow interpretation, and risk assessment based on real-time market data.',
  'ja-JP': '銘柄を選んで「AIと議論」をクリックすると、リアルタイムの市場データに基づいて専門的な分析を提供します。',
  'es-ES': 'Seleccione una acción y haga clic en "Discutir con IA" — Proporcionaré análisis técnico profesional basado en datos de mercado en tiempo real.',
} as const

const defaultSuggestions = {
  'zh-CN': [
    '分析这只股票的近期走势和技术形态',
    '当前主力资金流向如何？',
    '这只股票的估值水平合理吗？',
    '最近的新闻对这只股票有什么影响？',
    '帮我解读一下今天的K线形态',
  ],
  'en-US': [
    'Analyze the recent trend and technical patterns of this stock',
    'What is the current capital flow direction?',
    'Is the valuation of this stock reasonable?',
    'How is recent news affecting this stock?',
    'Help me interpret today\'s candlestick pattern',
  ],
  'ja-JP': [
    'この銘柄の最近のトレンドとテクニカルパターンを分析してください',
    '現在の資金フローはどうなっていますか？',
    'この銘柄のバリュエーションは妥当ですか？',
    '最近のニュースはこの銘柄にどのような影響を与えていますか？',
    '今日のローソク足パターンを解説してください',
  ],
  'es-ES': [
    'Analiza la tendencia reciente y los patrones técnicos de esta acción',
    '¿Cuál es la dirección actual del flujo de capital?',
    '¿Es razonable la valoración de esta acción?',
    '¿Cómo están afectando las noticias recientes a esta acción?',
    'Ayúdame a interpretar el patrón de velas de hoy',
  ],
} as const

interface EmptyStateProps {
  onPromptClick?: (text: string) => void
}

export const EmptyState = ({ onPromptClick }: EmptyStateProps) => {
  const { locale, t } = useI18n()

  const suggestions = useCallback(() => {
    const customPresets = loadPresetPrompts()
    if (customPresets.length > 0) {
      return customPresets
        .sort((a, b) => a.order - b.order)
        .map((p) => p.text)
    }
    return defaultSuggestions[locale]
  }, [locale])

  const displaySuggestions = suggestions()

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--accent-soft))] shadow-sm">
        <span className="text-[24px]">📊</span>
      </div>
      <p className="text-balance text-[20px] font-semibold tracking-tight text-[rgb(var(--text))] sm:text-[26px]">
        {t('chat.emptyTitle')}
      </p>
      <p className="mx-auto mt-3 max-w-[460px] text-balance text-[14px] leading-7 text-[rgb(var(--muted))] sm:text-[15px]">
        {supportCopy[locale]}
      </p>
      <div className="mx-auto mt-6 flex max-w-[520px] flex-wrap justify-center gap-2">
        {displaySuggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPromptClick?.(suggestion)}
            className="inline-block rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-[12px] text-[rgb(var(--muted))] hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))] transition cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
