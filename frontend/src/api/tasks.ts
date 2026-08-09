import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type { User } from './auth'
import type { WorkspaceRole } from './workspaces'

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Task {
  id: string
  project_id: string
  project_name: string
  workspace_id: string
  sprint_id: string | null
  sprint_name: string | null
  key: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee: User | null
  reporter: User
  role: WorkspaceRole
  created_at: string
  updated_at: string
}

export interface TaskCreate {
  title: string
  description?: string
  priority: TaskPriority
  assignee_id?: string | null
  sprint_id?: string | null
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string | null
  sprint_id?: string | null
}

export interface ListTasksParams {
  sprintId?: string
  backlog?: boolean
}

export function listTasks(projectId: string, params?: ListTasksParams): Promise<Task[]> {
  const query = new URLSearchParams()
  if (params?.backlog) {
    query.set('backlog', 'true')
  } else if (params?.sprintId) {
    query.set('sprint_id', params.sprintId)
  }
  const qs = query.toString()
  return apiGet<Task[]>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`)
}

export function createTask(projectId: string, payload: TaskCreate): Promise<Task> {
  return apiPost<Task>(`/projects/${projectId}/tasks`, payload)
}

export function getTask(taskId: string): Promise<Task> {
  return apiGet<Task>(`/tasks/${taskId}`)
}

export function updateTask(taskId: string, payload: TaskUpdate): Promise<Task> {
  return apiPatch<Task>(`/tasks/${taskId}`, payload)
}

export function deleteTask(taskId: string): Promise<void> {
  return apiDelete<void>(`/tasks/${taskId}`)
}
