import { useState } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { useChatContext } from '../../contexts/ChatContext'
import AIModelTab from './AIModelTab'
import PreferencesTab from './PreferencesTab'
import GeneralTab from './GeneralTab'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'ai-model' | 'preferences' | 'general'

export default function SettingsDrawer({ open, onClose }: Props) {
  const { t } = useI18n()
  const ctx = useChatContext()
  const [tab, setTab] = useState<Tab>('ai-model')

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 z-40 h-full w-full max-w-[390px] bg-[#1c1c28]/98 backdrop-blur-xl border-l border-white/5 shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-text-primary">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-text-secondary transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/5 px-3 gap-1">
          {([
            ['ai-model', t('settings.tab.aiModel')],
            ['preferences', t('settings.tab.preferences')],
            ['general', t('settings.tab.general')],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`px-3 py-2 text-xs font-medium transition border-b-2 -mb-[1px] ${
                tab === key
                  ? 'text-accent-blue border-accent-blue'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'ai-model' && <AIModelTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'general' && <GeneralTab />}
        </div>
      </div>
    </>
  )
}
