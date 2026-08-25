import { Outlet } from 'react-router-dom'
import { IconCheck } from './icons'

const FEATURES = [
  'Projects and team workspaces',
  'Sprints with a clear lifecycle',
  'Simple drag-and-drop tasks',
]

/**
 * Two-panel shell for the signed-out screens. The form keeps its narrow measure while the second
 * panel takes the width that would otherwise be blank.
 */
export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__form-panel">
        <Outlet />
      </div>

      <aside className="auth-layout__aside">
        <div className="auth-layout__aside-brand">
          <span className="sidebar__mark" aria-hidden="true">
            W
          </span>
          Work Stack
        </div>

        <div className="auth-layout__aside-pitch">
          <h2 className="auth-layout__aside-title">
            A minimal Scrum workspace for engineering teams.
          </h2>
          <p className="auth-layout__aside-body">
            Plan sprints, manage tasks, and keep your team aligned in one simple workspace.
          </p>
          <ul className="auth-layout__feature-list">
            {FEATURES.map((feature) => (
              <li key={feature} className="auth-layout__feature">
                <IconCheck size={15} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <span />
      </aside>
    </div>
  )
}
