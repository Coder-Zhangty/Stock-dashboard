import clsx from 'clsx'

import { useI18n } from '../../i18n/I18nProvider'
import type { Locale } from '../../i18n/messages'

const locales: Locale[] = ['zh-CN', 'en-US', 'ja-JP', 'es-ES']

interface LanguageSwitcherProps {
  compact?: boolean
  className?: string
}

export const LanguageSwitcher = ({
  compact = false,
  className,
}: LanguageSwitcherProps) => {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-full border border-line/70 bg-white/70 p-1 backdrop-blur-md',
        className,
      )}
    >
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          className={clsx(
            'rounded-full text-center font-medium transition duration-200',
            compact ? 'w-10 px-0 py-1 text-[11px]' : 'min-w-[56px] px-3 py-1.5 text-xs',
            locale === item
              ? 'bg-white text-ink shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
              : 'text-muted hover:bg-white/80 hover:text-ink',
          )}
        >
          {compact ? item.split('-')[0].toUpperCase() : t(`language.${item}`)}
        </button>
      ))}
    </div>
  )
}
