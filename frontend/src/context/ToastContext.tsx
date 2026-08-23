import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconAlert, IconCheckCircle, IconClose, IconInfo } from '../components/icons'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, kind }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            {toast.kind === 'success' ? (
              <IconCheckCircle size={16} />
            ) : toast.kind === 'error' ? (
              <IconAlert size={16} />
            ) : (
              <IconInfo size={16} />
            )}
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const NO_OP: ToastContextValue = { show: () => {} }

/**
 * Toasts are a confirmation nicety, never the only channel for information a user must act on —
 * so a component rendered outside the provider (as page components are in unit tests) degrades to
 * a no-op instead of throwing. Anything that *must* be seen uses an inline error banner.
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NO_OP
}
