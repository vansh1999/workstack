import { apiDelete, apiGet, apiPatch, apiPost } from './client'

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  start_date: string
  end_date: string
  status: SprintStatus
  created_at: string
  updated_at: string
}

export interface SprintCreate {
  name: string
  goal?: string
  start_date: string
  end_date: string
}

export interface SprintUpdate {
  name?: string
  goal?: string | null
  start_date?: string
  end_date?: string
}

export function listSprints(projectId: string): Promise<Sprint[]> {
  return apiGet<Sprint[]>(`/projects/${projectId}/sprints`)
}

export function createSprint(projectId: string, payload: SprintCreate): Promise<Sprint> {
  return apiPost<Sprint>(`/projects/${projectId}/sprints`, payload)
}

export function getSprint(sprintId: string): Promise<Sprint> {
  return apiGet<Sprint>(`/sprints/${sprintId}`)
}

export function updateSprint(sprintId: string, payload: SprintUpdate): Promise<Sprint> {
  return apiPatch<Sprint>(`/sprints/${sprintId}`, payload)
}

export function deleteSprint(sprintId: string): Promise<void> {
  return apiDelete<void>(`/sprints/${sprintId}`)
}

export function startSprint(sprintId: string): Promise<Sprint> {
  return apiPost<Sprint>(`/sprints/${sprintId}/start`)
}

export function completeSprint(sprintId: string): Promise<Sprint> {
  return apiPost<Sprint>(`/sprints/${sprintId}/complete`)
}
