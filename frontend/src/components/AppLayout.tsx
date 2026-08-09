import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { WorkspaceContext } from '../context/WorkspaceContext'
import * as workspacesApi from '../api/workspaces'
import type { Workspace, WorkspaceMember } from '../api/workspaces'
import { ApiError } from '../api/client'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false)
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [workspaceNotFound, setWorkspaceNotFound] = useState(false)

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null)
      return
    }

    let cancelled = false
    setIsLoadingWorkspace(true)
    setWorkspaceNotFound(false)

    workspacesApi
      .getWorkspace(workspaceId)
      .then((result) => {
        if (!cancelled) setWorkspace(result)
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) {
          setWorkspaceNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkspace(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const refreshMembers = useCallback(async () => {
    if (!workspaceId) return
    setIsLoadingMembers(true)
    try {
      setMembers(await workspacesApi.listMembers(workspaceId))
    } finally {
      setIsLoadingMembers(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) {
      refreshMembers()
    } else {
      setMembers([])
    }
  }, [workspaceId, refreshMembers])

  let content: ReactNode
  if (workspaceId && isLoadingWorkspace) {
    content = <p className="loading-state">Loading workspace…</p>
  } else if (workspaceId && (workspaceNotFound || !workspace)) {
    content = <Navigate to="/onboarding" replace />
  } else if (workspace) {
    content = (
      <WorkspaceContext.Provider value={{ workspace, members, isLoadingMembers, refreshMembers }}>
        <Outlet />
      </WorkspaceContext.Provider>
    )
  } else {
    content = <Outlet />
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar__brand-group">
          <span className="top-bar__brand">Work Stack</span>
          {workspace && (
            <>
              <span className="top-bar__separator">/</span>
              <Link className="top-bar__workspace" to="/onboarding">
                {workspace.name}
              </Link>
            </>
          )}
        </div>
        {user && (
          <div className="top-bar__user">
            <span>{user.email}</span>
            <button className="btn btn--secondary" onClick={() => logout()}>
              Log out
            </button>
          </div>
        )}
      </header>
      {workspace && (
        <nav className="workspace-nav">
          <NavLink
            to={`/workspaces/${workspace.id}`}
            end
            className={({ isActive }) =>
              `workspace-nav__link${isActive ? ' workspace-nav__link--active' : ''}`
            }
          >
            Projects
          </NavLink>
          <NavLink
            to={`/workspaces/${workspace.id}/members`}
            className={({ isActive }) =>
              `workspace-nav__link${isActive ? ' workspace-nav__link--active' : ''}`
            }
          >
            Members
          </NavLink>
        </nav>
      )}
      <main className="main-content">{content}</main>
    </div>
  )
}
