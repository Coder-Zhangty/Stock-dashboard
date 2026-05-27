import { useEffect, useMemo, useState } from 'react'

import {
  getStoredLayoutModePreference,
  resolveLayoutMode,
  setStoredLayoutModePreference,
  type LayoutModePreference,
  type LayoutModeRole,
} from '../services/layoutMode'

export const useLayoutMode = (role: LayoutModeRole) => {
  const [preference, setPreferenceState] = useState<LayoutModePreference>(() =>
    getStoredLayoutModePreference(role),
  )
  const [viewportTick, setViewportTick] = useState(0)

  useEffect(() => {
    setPreferenceState(getStoredLayoutModePreference(role))
  }, [role])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const notify = () => setViewportTick((current) => current + 1)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', notify)
      return () => mediaQuery.removeEventListener('change', notify)
    }

    mediaQuery.addListener(notify)
    return () => mediaQuery.removeListener(notify)
  }, [])

  const setPreference = (nextPreference: LayoutModePreference) => {
    setPreferenceState(nextPreference)
    setStoredLayoutModePreference(role, nextPreference)
  }

  const resolvedMode = useMemo(
    () => resolveLayoutMode(preference),
    [preference, viewportTick],
  )

  return {
    preference,
    resolvedMode,
    setPreference,
  }
}
