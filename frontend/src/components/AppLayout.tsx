import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { WorkspaceContext } from '../context/WorkspaceContext'
import { ShellProvider } from '../context/ShellContext'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceMember } from '../api/workspaces'
import type { Project } from '../api/projects'
import { useResourceById } from '../hooks/useResourceById'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Sidebar } from './Sidebar'
import { IconMenu } from './icons'

const COLLAPSED_KEY = 'workstack-sidebar-collapsed'

function parseBool(raw: string): boolean | null {
  return raw === 'true' ? true : raw === 'false' ? false : null
}

export function AppLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const location = useLocation()
  const isBoardRoute = useMatch('/projects/:projectId/board') !== null

  const {
    value: workspace,
    isPending,
    isNotFound,
    error,
  } = useResourceById(
    workspaceId,
    workspacesApi.getWorkspace,
    'Could not load this workspace. Please try again.',
  )

  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

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
    if (workspaceId) refreshMembers()
  }, [workspaceId, refreshMembers])

  const workspaceContext = useMemo(
    () =>
      workspace ? { workspace, members, isLoadingMembers, refreshMembers } : undefined,
    [workspace, members, isLoadingMembers, refreshMembers],
  )

  // Project routes live outside /workspaces/:workspaceId, so the project registers itself here.
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const shellContext = useMemo(
    () => ({ activeProject, setActiveProject }),
    [activeProject],
  )

  // Which workspace the sidebar shows. Held in state so it survives the gap between leaving a
  // /workspaces route and the project on the next route reporting which workspace it belongs to.
  const [shownWorkspace, setShownWorkspace] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const next = workspace
      ? { id: workspace.id, name: workspace.name }
      : activeProject
        ? { id: activeProject.workspace_id, name: activeProject.workspace_name }
        : null
    if (!next) return
    setShownWorkspace((prev) =>
      prev && prev.id === next.id && prev.name === next.name ? prev : next,
    )
  }, [workspace, activeProject])

  const [isCollapsed, setIsCollapsed] = useLocalStorage(COLLAPSED_KEY, false, parseBool)
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // A drawer that stayed open over the page it just navigated to would cover it.
  useEffect(() => {
    setIsDrawerOpen(false)
  }, [location.pathname])

  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])

  let body: ReactNode
  if (!workspaceId) {
    body = <Outlet />
  } else if (isNotFound) {
    body = <Navigate to="/onboarding" replace />
  } else if (error) {
    body = <div className="error-banner">{error}</div>
  } else if (isPending) {
    // The workspace for this id has not resolved yet. Rendering a redirect here instead is what
    // used to undo the navigation, making a project or workspace only openable on a second click.
    body = <p className="loading-state">Loading workspace…</p>
  } else {
    body = <Outlet />
  }

  return (
    <div className={`app-shell${isCollapsed ? ' app-shell--collapsed' : ''}`}>
      <Sidebar
        workspace={shownWorkspace}
        activeProject={activeProject}
        collapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isOpen={isDrawerOpen}
        onNavigate={closeDrawer}
      />

      {isMobile && isDrawerOpen && (
        <button
          type="button"
          className="sidebar__scrim"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      )}

      <div className="app-main">
        <div className="mobile-bar">
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isDrawerOpen}
          >
            <IconMenu size={18} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-ui)' }}>
            {activeProject?.name ?? shownWorkspace?.name ?? 'Work Stack'}
          </span>
        </div>

        <div className={`app-main__inner${isBoardRoute ? ' app-main__inner--wide' : ''}`}>
          {/* Both providers always wrap `body`, even when there is no workspace, so that leaving a
              workspace route does not change this element's type and tear down the whole subtree. */}
          <ShellProvider value={shellContext}>
            <WorkspaceContext.Provider value={workspaceContext}>{body}</WorkspaceContext.Provider>
          </ShellProvider>
        </div>
      </div>
    </div>
  )
}
