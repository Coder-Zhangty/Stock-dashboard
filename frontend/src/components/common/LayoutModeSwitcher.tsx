import clsx from 'clsx'

import { useI18n } from '../../i18n/I18nProvider'
import type { LayoutModePreference } from '../../services/layoutMode'

const labels = {
  'zh-CN': {
    auto: '自动',
    mobile: '手机',
    desktop: '电脑',
    fullAuto: '自动',
    fullMobile: '手机版',
    fullDesktop: '电脑版',
  },
  'en-US': {
    auto: 'Auto',
    mobile: 'Mobile',
    desktop: 'Desktop',
    fullAuto: 'Auto',
    fullMobile: 'Mobile',
    fullDesktop: 'Desktop',
  },
  'ja-JP': {
    auto: '自動',
    mobile: 'モバイル',
    desktop: 'デスクトップ',
    fullAuto: '自動',
    fullMobile: 'モバイル版',
    fullDesktop: 'デスクトップ版',
  },
  'es-ES': {
    auto: 'Auto',
    mobile: 'Móvil',
    desktop: 'Escritorio',
    fullAuto: 'Auto',
    fullMobile: 'Versión móvil',
    fullDesktop: 'Versión escritorio',
  },
} as const

interface LayoutModeSwitcherProps {
  value: LayoutModePreference
  onChange: (value: LayoutModePreference) => void
  compact?: boolean
  className?: string
}

export const LayoutModeSwitcher = ({
  value,
  onChange,
  compact = false,
  className,
}: LayoutModeSwitcherProps) => {
  const { locale } = useI18n()
  const copy = labels[locale]
  const items: Array<{ id: LayoutModePreference; label: string }> = compact
    ? [
        { id: 'auto', label: copy.auto },
        { id: 'mobile', label: copy.mobile },
        { id: 'desktop', label: copy.desktop },
      ]
    : [
        { id: 'auto', label: copy.fullAuto },
        { id: 'mobile', label: copy.fullMobile },
        { id: 'desktop', label: copy.fullDesktop },
      ]

  return (
    <div
      className={clsx(
        'inline-flex rounded-full border border-black/6 bg-white/78 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur-md',
        compact ? 'gap-1' : 'gap-1.5',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            'rounded-full font-medium transition duration-200',
            compact ? 'px-3 py-1.5 text-[11px] tracking-[0.02em]' : 'px-3.5 py-2 text-[12px]',
            value === item.id
              ? 'bg-[#161b26] text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
              : 'text-subtle hover:bg-white/80 hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
