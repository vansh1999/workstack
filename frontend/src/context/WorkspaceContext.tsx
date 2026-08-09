import { createContext, useContext } from 'react'
import type { Workspace, WorkspaceMember } from '../api/workspaces'

export interface WorkspaceContextValue {
  workspace: Workspace
  members: WorkspaceMember[]
  isLoadingMembers: boolean
  refreshMembers: () => Promise<void>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within an active workspace route')
  }
  return context
}

export function useWorkspaceOptional(): WorkspaceContextValue | undefined {
  return useContext(WorkspaceContext)
}
