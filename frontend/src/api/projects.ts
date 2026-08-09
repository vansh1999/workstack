import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type { WorkspaceRole } from './workspaces'

export interface Project {
  id: string
  workspace_id: string
  workspace_name: string
  name: string
  key: string
  description: string | null
  role: WorkspaceRole
  created_at: string
  updated_at: string
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
}

export function listProjects(workspaceId: string): Promise<Project[]> {
  return apiGet<Project[]>(`/workspaces/${workspaceId}/projects`)
}

export function createProject(
  workspaceId: string,
  name: string,
  key: string,
  description: string,
): Promise<Project> {
  return apiPost<Project>(`/workspaces/${workspaceId}/projects`, {
    name,
    key,
    description: description || undefined,
  })
}

export function getProject(projectId: string): Promise<Project> {
  return apiGet<Project>(`/projects/${projectId}`)
}

export function updateProject(projectId: string, payload: ProjectUpdate): Promise<Project> {
  return apiPatch<Project>(`/projects/${projectId}`, payload)
}

export function deleteProject(projectId: string): Promise<void> {
  return apiDelete<void>(`/projects/${projectId}`)
}
