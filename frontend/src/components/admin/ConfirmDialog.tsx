import clsx from 'clsx'

import { useI18n } from '../../i18n/I18nProvider'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  busy,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) => {
  const { locale } = useI18n()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[28px] border border-line/80 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-ink">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line/80 bg-white px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            {locale === 'zh-CN' ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={clsx(
              'rounded-full px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50',
              tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#111827] hover:bg-[#0f172a]',
            )}
          >
            {busy ? `${confirmLabel}...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
