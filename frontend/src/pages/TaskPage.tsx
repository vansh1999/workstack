import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import * as tasksApi from '../api/tasks'
import type { Task } from '../api/tasks'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceMember } from '../api/workspaces'
import { ApiError } from '../api/client'
import { TaskFormModal } from '../components/TaskFormModal'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function priorityBadgeClass(priority: Task['priority']): string {
  if (priority === 'URGENT') return 'badge badge--urgent'
  if (priority === 'HIGH') return 'badge badge--high'
  if (priority === 'LOW') return 'badge badge--low'
  return 'badge'
}

export function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!taskId) return
    tasksApi
      .getTask(taskId)
      .then(async (result) => {
        setTask(result)
        const [sprintList, memberList] = await Promise.all([
          sprintsApi.listSprints(result.project_id),
          workspacesApi.listMembers(result.workspace_id),
        ])
        setSprints(sprintList)
        setMembers(memberList)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
      })
      .finally(() => setIsLoading(false))
  }, [taskId])

  async function handleDelete() {
    if (!task) return
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    await tasksApi.deleteTask(task.id)
    navigate(`/projects/${task.project_id}/board`, { replace: true })
  }

  if (isLoading) {
    return <p className="loading-state">Loading task…</p>
  }

  if (notFound || !task) {
    return <Navigate to="/onboarding" replace />
  }

  const isOwner = task.role === 'OWNER'

  return (
    <div className="task-page">
      <Link className="project-page__back" to={`/projects/${task.project_id}/board`}>
        ← {task.project_name}
      </Link>

      <div className="project-page__header">
        <div>
          <p className="task-page__key">{task.key}</p>
          <h1 className="dashboard__title">{task.title}</h1>
        </div>
        <div className="project-page__actions">
          <button className="btn btn--secondary" onClick={() => setIsEditing(true)}>
            Edit
          </button>
          {isOwner && (
            <button className="btn btn--danger" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      {task.description && <p className="dashboard__subtitle">{task.description}</p>}

      <div className="meta-grid">
        <span className="meta-grid__label">Status</span>
        <span>{task.status}</span>

        <span className="meta-grid__label">Priority</span>
        <span className={priorityBadgeClass(task.priority)}>{task.priority}</span>

        <span className="meta-grid__label">Assignee</span>
        <span>{task.assignee?.full_name ?? 'Unassigned'}</span>

        <span className="meta-grid__label">Reporter</span>
        <span>{task.reporter.full_name}</span>

        <span className="meta-grid__label">Sprint</span>
        <span>{task.sprint_name ?? 'Backlog'}</span>

        <span className="meta-grid__label">Created</span>
        <span>{formatDateTime(task.created_at)}</span>

        <span className="meta-grid__label">Updated</span>
        <span>{formatDateTime(task.updated_at)}</span>
      </div>

      {isEditing && (
        <TaskFormModal
          mode="edit"
          projectId={task.project_id}
          members={members}
          sprints={sprints}
          task={task}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => {
            setTask(updated)
            setIsEditing(false)
          }}
        />
      )}
    </div>
  )
}
