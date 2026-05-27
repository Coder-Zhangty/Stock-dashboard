import { useI18n } from '../../i18n/I18nProvider'

const LOCALES = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en-US', label: 'English' },
  { id: 'ja-JP', label: '日本語' },
  { id: 'es-ES', label: 'Español' },
]

export default function GeneralTab() {
  const { t, locale, setLocale } = useI18n()

  return (
    <div className="space-y-5 overflow-y-auto">
      {/* Language */}
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-text-primary">{t('settings.general.language')}</p>
        <div className="mt-3 space-y-1">
          {LOCALES.map((loc) => {
            const active = locale === loc.id
            return (
              <button
                key={loc.id}
                onClick={() => setLocale(loc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-accent-blue/15 text-accent-blue font-medium'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                {loc.label}
                {active && <span className="ml-2 text-[10px] opacity-60">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Theme placeholder */}
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-text-primary">{t('settings.general.theme')}</p>
        <p className="mt-2 text-xs text-text-secondary opacity-60">
          主题设置即将推出
        </p>
      </div>
    </div>
  )
}
