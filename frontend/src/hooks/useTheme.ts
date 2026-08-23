import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'

export type ThemePref = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'workstack-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function parseThemePref(raw: string): ThemePref | null {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : null
}

function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

/**
 * The user's theme preference, and the theme that preference currently resolves to.
 *
 * `system` is the default: a hardcoded light default would override a preference the OS already
 * knows. Only the two explicit choices stamp `data-theme`; `system` removes the attribute so the
 * `prefers-color-scheme` block in tokens.css takes over again.
 */
export function useTheme() {
  const [preference, setPreference] = useLocalStorage<ThemePref>(
    THEME_STORAGE_KEY,
    'system',
    parseThemePref,
  )

  // Tracked in state so a live OS switch re-renders anything showing the resolved theme.
  const [systemIsDark, setSystemIsDark] = useState(prefersDark)

  useEffect(() => {
    let media: MediaQueryList
    try {
      media = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }

    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches)
    media.addEventListener('change', onChange)
    setSystemIsDark(media.matches)

    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') {
      delete root.dataset.theme
    } else {
      root.dataset.theme = preference
    }
  }, [preference])

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference

  // Used by the collapsed sidebar rail, where there is only room for one control.
  const cycle = useCallback(() => {
    setPreference(preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system')
  }, [preference, setPreference])

  return { preference, setPreference, resolved, cycle }
}
