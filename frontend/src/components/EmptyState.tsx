import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
  /** Tighter padding, for empty states nested inside a card or panel. */
  inline?: boolean
}

export function EmptyState({ icon, title, body, action, inline = false }: EmptyStateProps) {
  return (
    <div className={`empty-state${inline ? ' empty-state--inline' : ''}`}>
      {icon && <div className="empty-state__icon">{icon}</div>}
      <p className="empty-state__title">{title}</p>
      {body && <p className="empty-state__body">{body}</p>}
      {action}
    </div>
  )
}
