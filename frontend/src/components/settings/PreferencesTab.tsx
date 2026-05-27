import { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { usePreferences, tones } from '../../hooks/usePreferences'

export default function PreferencesTab() {
  const { t } = useI18n()
  const {
    preferences,
    setPreferences,
    memories,
    loading,
    saving,
    status,
    load,
    savePreferences,
    removeMemory,
  } = usePreferences()

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-5 overflow-y-auto">
      {/* Memory */}
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-text-primary">Memory</p>
        <p className="mt-1 text-xs text-text-secondary">{t('chat.memoryDesc')}</p>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2">
          <span className="text-xs text-text-primary">{t('chat.enableMemory')}</span>
          <button
            type="button"
            onClick={() =>
              setPreferences((current) =>
                current ? { ...current, memoryEnabled: !current.memoryEnabled } : current,
              )
            }
            className="rounded-full bg-accent-blue/20 px-2 py-0.5 text-[10px] text-accent-blue"
            disabled={!preferences}
          >
            {preferences?.memoryEnabled ? t('common.on') : t('common.off')}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              {t('chat.savedMemories')}
            </p>
            <span className="text-[10px] text-text-secondary">{memories.length}</span>
          </div>
          {loading ? (
            <p className="text-xs text-text-secondary">{t('chat.loading')}</p>
          ) : memories.length === 0 ? (
            <p className="text-xs text-text-secondary">{t('chat.noMemories')}</p>
          ) : (
            memories.map((memory) => (
              <div key={memory.id} className="rounded-lg bg-white/[0.06] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-text-primary">{memory.content}</p>
                  <button
                    onClick={() => removeMemory(memory.id)}
                    className="p-0.5 rounded text-text-secondary hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tone & Style */}
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-text-primary">{t('chat.toneStyle')}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tones.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() =>
                setPreferences((current) =>
                  current ? { ...current, toneStyle: tone.id } : current,
                )
              }
              className={`rounded-full px-3 py-1 text-xs transition ${
                tone.id === preferences?.toneStyle
                  ? 'bg-accent-blue/20 text-accent-blue'
                  : 'bg-white/[0.06] text-text-secondary hover:text-text-primary'
              }`}
            >
              {t(tone.labelKey)}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] text-text-secondary">{t('chat.warmth')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={preferences?.warmth ?? 55}
              onChange={(e) =>
                setPreferences((current) =>
                  current ? { ...current, warmth: Number(e.target.value) } : current,
                )
              }
              className="mt-1 w-full h-1 accent-accent-blue"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-text-secondary">{t('chat.responseLength')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={preferences?.responseLength ?? 62}
              onChange={(e) =>
                setPreferences((current) =>
                  current ? { ...current, responseLength: Number(e.target.value) } : current,
                )
              }
              className="mt-1 w-full h-1 accent-accent-blue"
            />
          </label>
        </div>
        {status && (
          <p className="mt-3 text-xs text-text-secondary">{status}</p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={savePreferences}
            disabled={!preferences || saving}
            className="rounded-full bg-accent-blue px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? t('chat.saving') : t('chat.savePreferences')}
          </button>
        </div>
      </div>
    </div>
  )
}
