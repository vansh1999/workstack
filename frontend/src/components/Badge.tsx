import type { ReactNode } from 'react'
import type { TaskPriority, TaskStatus } from '../api/tasks'
import type { SprintStatus } from '../api/sprints'
import type { WorkspaceRole } from '../api/workspaces'

export type BadgeTone = 'red' | 'amber' | 'green' | 'blue' | 'neutral' | 'muted' | 'strong'

interface BadgeProps {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot = false, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

/* Colour is spent only on meaning. MEDIUM, PLANNED, TODO and BACKLOG stay neutral on purpose —
 * if every state is tinted, none of them reads. */

const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  URGENT: 'red',
  HIGH: 'amber',
  MEDIUM: 'neutral',
  LOW: 'muted',
}

const SPRINT_TONE: Record<SprintStatus, BadgeTone> = {
  ACTIVE: 'green',
  PLANNED: 'neutral',
  COMPLETED: 'muted',
}

const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  BACKLOG: 'muted',
  TODO: 'neutral',
  IN_PROGRESS: 'blue',
  DONE: 'green',
}

const ROLE_TONE: Record<WorkspaceRole, BadgeTone> = {
  OWNER: 'neutral',
  MEMBER: 'muted',
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
}

export function SprintStatusBadge({ status }: { status: SprintStatus }) {
  return (
    <Badge tone={SPRINT_TONE[status]} dot>
      {status}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONE[status]}>{status}</Badge>
}

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return <Badge tone={ROLE_TONE[role]}>{role}</Badge>
}
