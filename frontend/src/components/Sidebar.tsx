import { Link, NavLink } from 'react-router-dom'
import type { Project } from '../api/projects'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import {
  IconBoard,
  IconInfo,
  IconLayers,
  IconPanelLeft,
  IconSprint,
  IconUsers,
} from './icons'

interface SidebarProps {
  workspace: { id: string; name: string } | null
  activeProject: Project | null
  collapsed: boolean
  onToggleCollapse: () => void
  isOpen: boolean
  onNavigate: () => void
}

// NavLink sets aria-current="page" on the active link by itself; the active styling keys off that
// attribute rather than a second class, so there is one source of truth.
const navClass = 'sidebar__link'

export function Sidebar({
  workspace,
  activeProject,
  collapsed,
  onToggleCollapse,
  isOpen,
  onNavigate,
}: SidebarProps) {
  const classes = ['sidebar']
  if (collapsed) classes.push('sidebar--collapsed')
  if (isOpen) classes.push('sidebar--open')

  return (
    <nav className={classes.join(' ')} aria-label="Main">
      <div className="sidebar__brand-row">
        <Link className="sidebar__brand" to="/onboarding" onClick={onNavigate}>
          {/* aria-hidden so the link's accessible name stays exactly "Work Stack". */}
          <span className="sidebar__mark" aria-hidden="true">
            W
          </span>
          <span>Work Stack</span>
        </Link>
        <button
          type="button"
          className="btn btn--icon sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconPanelLeft size={16} />
        </button>
      </div>

      <div className="sidebar__scroll">
        <div className="sidebar__section">
          <WorkspaceSwitcher current={workspace} collapsed={collapsed} onNavigate={onNavigate} />
        </div>

        {workspace && (
          <div className="sidebar__section">
            <NavLink
              to={`/workspaces/${workspace.id}`}
              end
              className={navClass}
              onClick={onNavigate}
              title={collapsed ? 'Projects' : undefined}
            >
              <IconLayers size={16} />
              <span>Projects</span>
            </NavLink>
            <NavLink
              to={`/workspaces/${workspace.id}/members`}
              className={navClass}
              onClick={onNavigate}
              title={collapsed ? 'Members' : undefined}
            >
              <IconUsers size={16} />
              <span>Members</span>
            </NavLink>
          </div>
        )}

        {activeProject && (
          <div className="sidebar__section">
            <p className="sidebar__section-label" title={activeProject.name}>
              <span>{activeProject.name}</span>
            </p>
            <NavLink
              to={`/projects/${activeProject.id}/overview`}
              className={navClass}
              onClick={onNavigate}
              title={collapsed ? 'Overview' : undefined}
            >
              <IconInfo size={16} />
              <span>Overview</span>
            </NavLink>
            <NavLink
              to={`/projects/${activeProject.id}/sprints`}
              className={navClass}
              onClick={onNavigate}
              title={collapsed ? 'Sprints' : undefined}
            >
              <IconSprint size={16} />
              <span>Sprints</span>
            </NavLink>
            <NavLink
              to={`/projects/${activeProject.id}/board`}
              className={navClass}
              onClick={onNavigate}
              title={collapsed ? 'Board' : undefined}
            >
              <IconBoard size={16} />
              <span>Board</span>
            </NavLink>
          </div>
        )}
      </div>

      <div className="sidebar__footer">
        <UserMenu collapsed={collapsed} />
      </div>
    </nav>
  )
}
