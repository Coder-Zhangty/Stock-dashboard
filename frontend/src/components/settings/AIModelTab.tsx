import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useChatContext } from '../../contexts/ChatContext'
import { useI18n } from '../../i18n/I18nProvider'

export default function AIModelTab() {
  const ctx = useChatContext()
  const { t } = useI18n()

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    ctx.activeProviderId ?? ctx.modelGroups[0]?.providerId ?? null,
  )

  useEffect(() => {
    if (ctx.activeProviderId) {
      setSelectedProviderId(ctx.activeProviderId)
    }
  }, [ctx.activeProviderId])

  const visibleProvider = useMemo(
    () => ctx.modelGroups.find((g) => g.providerId === selectedProviderId),
    [ctx.modelGroups, selectedProviderId],
  )

  return (
    <div className="flex flex-col h-full">
      <p className="px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
        {t('settings.tab.aiModel')}
      </p>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Provider list */}
        <div className="w-[160px] shrink-0 space-y-0.5 overflow-y-auto">
          {ctx.modelGroups.map((group) => {
            const active = selectedProviderId === group.providerId
            return (
              <button
                key={group.providerId}
                onClick={() => setSelectedProviderId(group.providerId)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${
                  active
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                {group.providerLabel}
              </button>
            )
          })}
        </div>

        {/* Model list */}
        <div className="flex-1 min-w-0 space-y-0.5 overflow-y-auto">
          {visibleProvider?.models.map((model) => {
            const active = model.id === ctx.activeModel
            return (
              <button
                key={model.id}
                onClick={() => ctx.handleSelectModel(model.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition ${
                  active
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'text-text-primary hover:bg-white/5'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{model.label}</span>
                  {model.description && (
                    <span className="text-[10px] text-text-secondary truncate block mt-0.5">
                      {model.description}
                    </span>
                  )}
                </div>
                {active && <Check size={14} className="shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
