export type LayoutModePreference = 'auto' | 'mobile' | 'desktop'
export type ResolvedLayoutMode = 'mobile' | 'desktop'
export type LayoutModeRole = 'user' | 'admin'

const STORAGE_KEYS: Record<LayoutModeRole, string> = {
  user: 'aurora.layout.user',
  admin: 'aurora.layout.admin',
}

const hasWindow = () => typeof window !== 'undefined'

const readStorage = (key: string) => {
  if (!hasWindow()) return ''
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

const writeStorage = (key: string, value: string) => {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore private-mode or browser storage failures.
  }
}

export const isMobileViewport = () => {
  if (!hasWindow()) return false
  return window.matchMedia('(max-width: 767px)').matches
}

export const getStoredLayoutModePreference = (
  role: LayoutModeRole,
): LayoutModePreference => {
  const value = readStorage(STORAGE_KEYS[role])
  return value === 'mobile' || value === 'desktop' ? value : 'auto'
}

export const setStoredLayoutModePreference = (
  role: LayoutModeRole,
  value: LayoutModePreference,
) => {
  writeStorage(STORAGE_KEYS[role], value)
}

export const resolveLayoutMode = (
  preference: LayoutModePreference,
): ResolvedLayoutMode => {
  if (preference === 'mobile' || preference === 'desktop') {
    return preference
  }
  return isMobileViewport() ? 'mobile' : 'desktop'
}
