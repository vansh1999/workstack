import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowLeft } from './icons'

interface PageHeaderProps {
  title: ReactNode
  /** Rendered next to the title — a key chip or a status badge. */
  titleAside?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  /** Render the title as an <h2>, for headers nested under a page-level <h1>. */
  as?: 'h1' | 'h2'
}

export function PageHeader({
  title,
  titleAside,
  description,
  actions,
  backTo,
  backLabel,
  as: Heading = 'h1',
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {backTo && (
          <Link className="page-header__breadcrumb" to={backTo}>
            <IconArrowLeft size={14} />
            {backLabel}
          </Link>
        )}
        <div className="page-header__title-row">
          <Heading className="page-header__title">{title}</Heading>
          {titleAside}
        </div>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
