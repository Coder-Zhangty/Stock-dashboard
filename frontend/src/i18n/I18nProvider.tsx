/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { messages, type Locale } from './messages'

const STORAGE_KEY = 'aurora-locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  tList: (key: string) => string[]
  formatDate: (value: string | number | Date) => string
  formatNumber: (value: number) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const readInitialLocale = (): Locale => {
  const raw = localStorage.getItem(STORAGE_KEY) as Locale | null
  return raw && raw in messages ? raw : DEFAULT_LOCALE
}

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(() => {
    const bundle = messages[locale]
    const fallback = messages['en-US']

    const readMessage = (key: string) => bundle[key] ?? fallback[key] ?? key

    return {
      locale,
      setLocale: (nextLocale) => setLocaleState(nextLocale),
      t: (key) => {
        const value = readMessage(key)
        return Array.isArray(value) ? value.join(' ') : value
      },
      tList: (key) => {
        const value = readMessage(key)
        return Array.isArray(value) ? value : [value]
      },
      formatDate: (value) => new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
      formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.')
  }
  return context
}
