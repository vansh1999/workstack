import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as workspacesApi from '../api/workspaces'
import type { Workspace } from '../api/workspaces'
import { useDismissable } from '../hooks/useDismissable'
import { Avatar } from './Avatar'
import { IconCheck, IconChevronUpDown, IconPlus } from './icons'

interface WorkspaceSwitcherProps {
  current?: { id: string; name: string } | null
  collapsed: boolean
  onNavigate?: () => void
}

export function WorkspaceSwitcher({ current, collapsed, onNavigate }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismissable(anchorRef, isOpen, close)

  // Loaded on first open rather than on mount — most sessions never switch workspace.
  function toggle() {
    setIsOpen((open) => {
      if (!open && workspaces === null) {
        workspacesApi
          .listWorkspaces()
          .then(setWorkspaces)
          .catch(() => setWorkspaces([]))
      }
      return !open
    })
  }

  const label = current?.name ?? 'Select workspace'

  return (
    <div className="popover-anchor" ref={anchorRef}>
      <button
        type="button"
        className="menu-trigger"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={collapsed ? label : undefined}
      >
        <Avatar name={label} label={current ? undefined : '—'} />
        <span className="menu-trigger__text">
          <span className="menu-trigger__title">{label}</span>
          <span className="menu-trigger__subtitle">Workspace</span>
        </span>
        <IconChevronUpDown size={14} className="menu-trigger__chevron" />
      </button>

      {isOpen && (
        <div className="popover popover--below" role="menu">
          <p className="popover__label">Workspaces</p>
          {workspaces === null ? (
            <p className="popover__item" aria-live="polite">
              Loading…
            </p>
          ) : workspaces.length === 0 ? (
            <p className="popover__item">No workspaces yet</p>
          ) : (
            workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                to={`/workspaces/${workspace.id}`}
                role="menuitem"
                className={`popover__item${workspace.id === current?.id ? ' popover__item--current' : ''}`}
                onClick={() => {
                  close()
                  onNavigate?.()
                }}
              >
                <Avatar name={workspace.name} size="sm" />
                <span className="menu-trigger__title">{workspace.name}</span>
                {workspace.id === current?.id && (
                  <IconCheck size={14} className="popover__item-check" />
                )}
              </Link>
            ))
          )}
          <div className="popover__separator" />
          <Link
            to="/onboarding"
            role="menuitem"
            className="popover__item"
            onClick={() => {
              close()
              onNavigate?.()
            }}
          >
            <IconPlus size={14} />
            New workspace
          </Link>
        </div>
      )}
    </div>
  )
}
