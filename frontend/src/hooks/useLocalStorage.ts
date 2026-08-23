import { useCallback, useState } from 'react'

/**
 * State backed by localStorage.
 *
 * Every access is guarded: a private window, blocked site data, or a browser that throws on the
 * accessor itself must degrade to plain in-memory state rather than take the app down.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  parse: (raw: string) => T | null,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return initialValue
      return parse(raw) ?? initialValue
    } catch {
      return initialValue
    }
  })

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Persisting is best-effort; the in-memory value is still correct for this session.
      }
    },
    [key],
  )

  return [value, set]
}
