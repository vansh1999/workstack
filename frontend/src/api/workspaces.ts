import { apiGet, apiPost } from './client'
import type { User } from './auth'

export type WorkspaceRole = 'OWNER' | 'MEMBER'

export interface Workspace {
  id: string
  name: string
  role: WorkspaceRole
  created_at: string
}

export interface WorkspaceMember {
  id: string
  role: WorkspaceRole
  created_at: string
  user: User
}

export interface InvitationCreateResult {
  id: string
  workspace_id: string
  email: string
  expires_at: string
  created_at: string
  invite_url: string
}

export type InvitationStatus = 'pending' | 'expired' | 'accepted'

export interface InvitationPublic {
  workspace_name: string
  email: string
  status: InvitationStatus
}

export interface InvitationAcceptResult {
  workspace: Workspace
}

export function listWorkspaces(): Promise<Workspace[]> {
  return apiGet<Workspace[]>('/workspaces')
}

export function createWorkspace(name: string): Promise<Workspace> {
  return apiPost<Workspace>('/workspaces', { name })
}

export function getWorkspace(workspaceId: string): Promise<Workspace> {
  return apiGet<Workspace>(`/workspaces/${workspaceId}`)
}

export function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return apiGet<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
}

export function createInvitation(
  workspaceId: string,
  email: string,
): Promise<InvitationCreateResult> {
  return apiPost<InvitationCreateResult>(`/workspaces/${workspaceId}/invitations`, { email })
}

export function getInvitation(token: string): Promise<InvitationPublic> {
  return apiGet<InvitationPublic>(`/invitations/${token}`)
}

export function acceptInvitation(token: string): Promise<InvitationAcceptResult> {
  return apiPost<InvitationAcceptResult>(`/invitations/${token}/accept`)
}
