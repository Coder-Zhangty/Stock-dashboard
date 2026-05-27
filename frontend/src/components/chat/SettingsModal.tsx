import { Trash2, X } from 'lucide-react'
import { useEffect } from 'react'

import { PresetPrompts } from '../../features/chat/PresetPrompts'
import { useI18n } from '../../i18n/I18nProvider'
import { usePreferences, tones } from '../../hooks/usePreferences'

type SettingsSection = 'general' | 'projects'

interface SettingsModalProps {
  open: boolean
  section: SettingsSection
  onClose: () => void
}

export const SettingsModal = ({
  open,
  section,
  onClose,
}: SettingsModalProps) => {
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

  useEffect(() => {
    if (!open || section !== 'general') return
    let cancelled = false
    const loadPrefs = async () => {
      await load()
    }
    void loadPrefs()
    return () => {
      cancelled = true
    }
  }, [open, section, load])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[720px] rounded-[28px] border border-line/80 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">
              {section === 'projects' ? t('chat.projects') : t('chat.settings')}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">
              {section === 'projects' ? t('chat.projectSpaces') : t('chat.preferences')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line/80 bg-white text-muted transition hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        {section === 'general' ? (
          <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
            <div className="rounded-2xl border border-line/80 bg-[rgb(var(--surface-muted))] p-4">
              <p className="text-sm font-medium text-ink">Memory</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t('chat.memoryDesc')}
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-ink">{t('chat.enableMemory')}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((current) =>
                      current ? { ...current, memoryEnabled: !current.memoryEnabled } : current,
                    )
                  }
                  className="rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-xs text-accent"
                  disabled={!preferences}
                >
                  {preferences?.memoryEnabled ? t('common.on') : t('common.off')}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                    {t('chat.savedMemories')}
                  </p>
                  <span className="text-xs text-subtle">{memories.length}</span>
                </div>
                {loading ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-muted">
                    {t('chat.loading')}
                  </p>
                ) : memories.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-muted">
                    {t('chat.noMemories')}
                  </p>
                ) : (
                  memories.map((memory) => (
                    <div key={memory.id} className="rounded-xl bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-6 text-ink">{memory.content}</p>
                        <button
                          type="button"
                          onClick={() => {
                            void removeMemory(memory.id)
                          }}
                          className="rounded-full p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-subtle">
                        {new Date(memory.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-line/80 bg-[rgb(var(--surface-muted))] p-4">
              <PresetPrompts />
            </div>

            <div className="rounded-2xl border border-line/80 bg-[rgb(var(--surface-muted))] p-4">
              <p className="text-sm font-medium text-ink">{t('chat.toneStyle')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tones.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setPreferences((current) => (current ? { ...current, toneStyle: tone.id } : current))}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      tone.id === preferences?.toneStyle
                        ? 'bg-[rgb(var(--accent-soft))] text-accent'
                        : 'bg-white text-muted'
                    }`}
                  >
                    {t(tone.labelKey)}
                  </button>
                ))}
              </div>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs text-subtle">{t('chat.warmth')}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={preferences?.warmth ?? 55}
                    onChange={(event) =>
                      setPreferences((current) => current ? { ...current, warmth: Number(event.target.value) } : current)
                    }
                    className="mt-2 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-subtle">{t('chat.responseLength')}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={preferences?.responseLength ?? 62}
                    onChange={(event) =>
                      setPreferences((current) =>
                        current ? { ...current, responseLength: Number(event.target.value) } : current,
                      )
                    }
                    className="mt-2 w-full"
                  />
                </label>
              </div>
              {status ? <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs text-muted">{status}</p> : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void savePreferences()
                  }}
                  disabled={!preferences || saving}
                  className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
                >
                  {saving ? t('chat.saving') : t('chat.savePreferences')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 px-6 py-6">
            {[t('chat.projectMarketing'), t('chat.projectInvestor'), t('chat.projectResearch')].map((project) => (
              <div
                key={project}
                className="rounded-2xl border border-line/80 bg-[rgb(var(--surface-muted))] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{project}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {t('chat.projectDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-xs text-ink"
                  >
                    {t('common.open')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
