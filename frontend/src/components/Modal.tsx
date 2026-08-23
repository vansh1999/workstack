import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconClose } from './icons'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Widen past the 480px default, e.g. for a two-column form. */
  size?: 'md' | 'lg'
}

/**
 * Accessible dialog: labelled, Esc to close, focus trapped inside while open, and focus returned
 * to whatever opened it on close.
 */
export function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Held in a ref so the effect below can run once on mount. Callers pass an inline arrow for
  // onClose, so depending on it re-ran the effect on every keystroke — which pulled focus out of
  // whichever field was being typed into and made the form look like it rejected input.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Land on the first field so the form can be typed into straight away; fall back to the
    // dialog itself when it has no fields.
    const firstField = panelRef.current?.querySelector<HTMLElement>('input, select, textarea')
    ;(firstField ?? panelRef.current)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
    // Mount/unmount only: re-running this would steal focus mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={size === 'lg' ? { maxWidth: '620px' } : undefined}
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
