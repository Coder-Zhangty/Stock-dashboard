import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'

import type { AuthSecurityConfig } from '../../types/auth'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      remove?: (widgetId: string) => void
      reset?: (widgetId?: string) => void
    }
  }
}

interface HumanVerificationFieldProps {
  config: AuthSecurityConfig
  value: string
  onChange: (token: string) => void
  label: string
}

export interface HumanVerificationFieldHandle {
  reset: () => void
}

let turnstileLoader: Promise<void> | null = null

const loadTurnstile = () => {
  if (turnstileLoader) return turnstileLoader
  turnstileLoader = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile.'))
    document.head.appendChild(script)
  })
  return turnstileLoader
}

export const HumanVerificationField = forwardRef<
  HumanVerificationFieldHandle,
  HumanVerificationFieldProps
>(({ config, value, onChange, label }, ref) => {
  const siteKey = config.siteKey ?? null
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onChange('')
        if (config.provider === 'turnstile' && widgetIdRef.current && window.turnstile?.reset) {
          window.turnstile.reset(widgetIdRef.current)
        }
      },
    }),
    [config.provider, onChange],
  )

  useEffect(() => {
    if (config.provider !== 'turnstile' || !siteKey || !containerRef.current) {
      return
    }

    let disposed = false

    void loadTurnstile()
      .then(() => {
        if (disposed || !window.turnstile || !containerRef.current) return
        containerRef.current.innerHTML = ''
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onChange(token),
          'error-callback': () => onChange(''),
          'expired-callback': () => onChange(''),
        })
      })
      .catch(() => {
        onChange('')
      })

    return () => {
      disposed = true
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [config.provider, onChange, siteKey])

  if (config.provider === 'turnstile' && siteKey) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-subtle">{label}</p>
        <div
          ref={containerRef}
          className="min-h-[74px] max-w-full overflow-x-auto rounded-[24px] border border-black/6 bg-white/84 px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-subtle">{label}</p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={config.mockTokenHint ?? 'human-pass'}
        className="h-11 w-full rounded-full border border-black/6 bg-white/85 px-4 text-sm text-ink outline-none transition duration-200 focus:border-indigo-500/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
      />
      <p className="text-[11px] text-muted">
        {config.mockTokenHint
          ? `Mock token: ${config.mockTokenHint}`
          : 'Enter the verification token.'}
      </p>
    </div>
  )
})

HumanVerificationField.displayName = 'HumanVerificationField'
