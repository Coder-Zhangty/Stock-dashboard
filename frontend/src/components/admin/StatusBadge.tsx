import clsx from 'clsx'
import type { ReactNode } from 'react'

interface StatusBadgeProps {
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

const tones: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-blue-50 text-blue-700',
}

export const StatusBadge = ({ tone = 'default', children }: StatusBadgeProps) => (
  <span
    className={clsx(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]',
      tones[tone],
    )}
  >
    {children}
  </span>
)
