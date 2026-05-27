import clsx from 'clsx'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface MobileSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  fullHeight?: boolean
}

export const MobileSheet = ({
  open,
  title,
  onClose,
  children,
  fullHeight = false,
}: MobileSheetProps) => {
  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-0 z-50 lg:hidden',
        open && 'pointer-events-auto',
      )}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={clsx(
          'absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[2px] transition duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className={clsx(
          'absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[32px] border border-black/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,249,251,0.94))] shadow-[0_-28px_72px_rgba(15,23,42,0.22)] backdrop-blur-xl transition duration-300',
          fullHeight ? 'top-16' : 'max-h-[78vh]',
          open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="space-y-1.5">
            <div className="mx-auto h-1 w-12 rounded-full bg-black/10" />
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mobile-toolbar-button flex h-9 w-9 items-center justify-center rounded-full text-subtle transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mobile-sheet-scroll overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}
