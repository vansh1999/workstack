import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

/**
 * State of a resource that is fetched by id.
 *
 * Every settled status carries the `id` it was produced for. Callers must compare that `id`
 * against the id they are currently rendering before acting on the status — otherwise the first
 * render after an id change reads a conclusion drawn about the *previous* id, which is how a
 * freshly navigated-to route ends up redirecting itself away before its fetch has even started.
 */
export type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading'; id: string; value: T | null }
  | { status: 'ready'; id: string; value: T }
  | { status: 'notFound'; id: string }
  | { status: 'error'; id: string; message: string }

export interface Resource<T> {
  /** The value, but only when it belongs to the `id` that was passed in. Never stale. */
  value: T | null
  /** True while there is nothing to show for `id` yet. */
  isPending: boolean
  /** Set only when the current `id` was confirmed missing (404). */
  isNotFound: boolean
  /** Set only when loading the current `id` failed for a reason other than 404. */
  error: string | null
  /** Replace the value locally, e.g. after a PATCH. */
  setValue: (value: T) => void
}

/**
 * Loads a resource by id, keeping the resulting state keyed to that id.
 *
 * Pass `undefined` as the id when the current route has no such resource; the last loaded value
 * is retained but never reported, so no state update — and therefore no remount of the subtree —
 * happens on routes that do not care about it.
 */
export function useResourceById<T>(
  id: string | undefined,
  fetcher: (id: string) => Promise<T>,
  notFoundMessage = 'Could not load this. Please try again.',
): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'idle' })

  // Held in a ref so callers may pass an inline function without retriggering the fetch.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const messageRef = useRef(notFoundMessage)
  messageRef.current = notFoundMessage

  useEffect(() => {
    if (!id) return

    let cancelled = false

    // Keep an already-loaded value on screen while it refreshes, so re-entering a route the
    // user just came from does not flash a loading state.
    setState((prev) => ({
      status: 'loading',
      id,
      value: prev.status === 'ready' && prev.id === id ? prev.value : null,
    }))

    fetcherRef
      .current(id)
      .then((value) => {
        if (!cancelled) setState({ status: 'ready', id, value })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'notFound', id })
        } else {
          setState({
            status: 'error',
            id,
            message: err instanceof ApiError ? err.message : messageRef.current,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const setValue = useCallback(
    (value: T) => {
      if (!id) return
      setState({ status: 'ready', id, value })
    },
    [id],
  )

  const matchesId = id !== undefined && 'id' in state && state.id === id

  const value =
    matchesId && (state.status === 'ready' || state.status === 'loading') ? state.value : null

  const isSettled =
    matchesId &&
    (state.status === 'ready' || state.status === 'notFound' || state.status === 'error')

  return {
    value,
    isPending: id !== undefined && value === null && !isSettled,
    isNotFound: matchesId && state.status === 'notFound',
    error: matchesId && state.status === 'error' ? state.message : null,
    setValue,
  }
}
