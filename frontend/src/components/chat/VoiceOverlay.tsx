import { Mic, X } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'

interface VoiceOverlayProps {
  open: boolean
  onClose: () => void
}

export const VoiceOverlay = ({ open, onClose }: VoiceOverlayProps) => {
  const { t } = useI18n()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/82 p-4 backdrop-blur-xl">
      <div className="relative flex w-full max-w-[460px] flex-col items-center rounded-[32px] border border-white/10 bg-white/5 px-8 py-12 text-white">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/25" />
          <span className="absolute inline-flex h-[88px] w-[88px] rounded-full bg-sky-400/20" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-sky-400 text-white">
            <Mic size={24} />
          </span>
        </div>

        <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-white/45">
          {t('chat.advancedVoice')}
        </p>
        <h3 className="mt-3 text-center text-[28px] font-semibold tracking-[-0.04em]">
          {t('chat.voiceTitle')}
        </h3>
        <p className="mt-3 text-center text-sm leading-6 text-white/65">
          {t('chat.voiceBody')}
        </p>
      </div>
    </div>
  )
}
