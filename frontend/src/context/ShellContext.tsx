import { createContext, useContext } from 'react'
import type { Project } from '../api/projects'

interface ShellContextValue {
  /** The project the current route is inside, or null. Registered by ProjectLayout. */
  activeProject: Project | null
  setActiveProject: (project: Project | null) => void
}

/**
 * Lets a nested route tell the shell which project it is showing.
 *
 * Project routes are `/projects/:projectId`, not nested under `/workspaces/:workspaceId`, so the
 * layout above them cannot read the project from the URL. Without this the sidebar loses both the
 * project nav and the workspace it belongs to the moment a project is opened.
 *
 * The default is a working no-op so route components still render outside the shell (unit tests).
 */
const ShellContext = createContext<ShellContextValue>({
  activeProject: null,
  setActiveProject: () => {},
})

export const ShellProvider = ShellContext.Provider

export function useShell(): ShellContextValue {
  return useContext(ShellContext)
}
