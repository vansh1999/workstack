import { useEffect, useState } from 'react'

/** Tracks a media query. Returns false when matchMedia is unavailable (e.g. older jsdom). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    let media: MediaQueryList
    try {
      media = window.matchMedia(query)
    } catch {
      return
    }

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    media.addEventListener('change', onChange)
    setMatches(media.matches)

    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}
