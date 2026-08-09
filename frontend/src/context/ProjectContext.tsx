import { createContext, useContext } from 'react'
import type { Project } from '../api/projects'

export interface ProjectContextValue {
  project: Project
  setProject: (project: Project) => void
}

export const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within an active project route')
  }
  return context
}
