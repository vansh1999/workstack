import { useCallback, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useDismissable } from '../hooks/useDismissable'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeToggle'
import { IconChevronUpDown, IconLogout, IconMonitor, IconMoon, IconSun } from './icons'

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth()
  const { preference, setPreference, resolved, cycle } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismissable(anchorRef, isOpen, close)

  if (!user) return null

  // The collapsed rail has room for one control, so the theme becomes a cycling icon button.
  if (collapsed) {
    const CycleIcon =
      preference === 'system' ? IconMonitor : resolved === 'dark' ? IconMoon : IconSun
    return (
      <div className="sidebar__section" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn--icon"
          onClick={cycle}
          aria-label={`Theme: ${preference}. Change theme`}
          title={`Theme: ${preference}`}
        >
          <CycleIcon size={16} />
        </button>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => logout()}
          aria-label="Log out"
          title="Log out"
        >
          <IconLogout size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="popover-anchor" ref={anchorRef}>
      <button
        type="button"
        className="menu-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Avatar name={user.full_name || user.email} />
        <span className="menu-trigger__text">
          <span className="menu-trigger__title">{user.full_name || user.email}</span>
          <span className="menu-trigger__subtitle">{user.email}</span>
        </span>
        <IconChevronUpDown size={14} className="menu-trigger__chevron" />
      </button>

      {isOpen && (
        <div className="popover popover--above">
          <p className="popover__label">Appearance</p>
          <div style={{ padding: '0 var(--space-2) var(--space-2)' }}>
            <ThemeToggle value={preference} onChange={setPreference} />
          </div>
          <div className="popover__separator" />
          <button type="button" className="popover__item" onClick={() => logout()}>
            <IconLogout size={15} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
