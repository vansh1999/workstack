import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Closes a popover on Escape or on a pointer press outside of `ref`. */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, isOpen, onDismiss])
}
