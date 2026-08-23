import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import * as tasksApi from '../api/tasks'
import type { Task, TaskPriority, TaskStatus } from '../api/tasks'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceMember } from '../api/workspaces'
import { ApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import { TaskFormModal } from '../components/TaskFormModal'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { Avatar } from '../components/Avatar'
import { useResourceById } from '../hooks/useResourceById'
import { IconCopy } from '../components/icons'
import { formatDateTime, formatRelative } from '../lib/dates'

const STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE']
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const {
    value: task,
    isPending,
    isNotFound,
    error: loadError,
    setValue: setTask,
  } = useResourceById<Task>(taskId, tasksApi.getTask, 'Could not load this task. Please try again.')

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Options for the edit modal. Loaded once the task tells us which project and workspace it
  // belongs to; a failure here only costs the dropdowns, so it must not block the task itself.
  const projectId = task?.project_id
  const workspaceId = task?.workspace_id

  useEffect(() => {
    if (!projectId || !workspaceId) return

    let cancelled = false
    Promise.all([sprintsApi.listSprints(projectId), workspacesApi.listMembers(workspaceId)])
      .then(([sprintList, memberList]) => {
        if (cancelled) return
        setSprints(sprintList)
        setMembers(memberList)
      })
      .catch(() => {
        if (!cancelled) {
          setSprints([])
          setMembers([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectId, workspaceId])

  /** Optimistic inline edit, mirroring the board: apply, then roll back if the API refuses. */
  async function patchTask(patch: tasksApi.TaskUpdate) {
    if (!task) return
    const previous = task
    setTask({ ...task, ...patch } as Task)
    setIsSaving(true)
    try {
      setTask(await tasksApi.updateTask(task.id, patch))
    } catch (err) {
      setTask(previous)
      toast.show(
        err instanceof ApiError ? err.message : 'Could not save that change. Please try again.',
        'error',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function copyKey() {
    if (!task) return
    try {
      await navigator.clipboard.writeText(task.key)
      toast.show(`Copied ${task.key}.`, 'success')
    } catch {
      toast.show('Could not copy the task key.', 'error')
    }
  }

  async function handleDelete() {
    if (!task) return
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    await tasksApi.deleteTask(task.id)
    navigate(`/projects/${task.project_id}/board`, { replace: true })
  }

  if (isNotFound) {
    return <Navigate to="/onboarding" replace />
  }

  if (loadError) {
    return <div className="error-banner">{loadError}</div>
  }

  if (isPending || !task) {
    return (
      <div className="stack">
        <Skeleton width="120px" height="14px" />
        <Skeleton width="340px" height="24px" />
        <Skeleton height="80px" />
      </div>
    )
  }

  const isOwner = task.role === 'OWNER'

  return (
    <>
      <PageHeader
        title={task.title}
        backTo={`/projects/${task.project_id}/board`}
        backLabel={task.project_name}
        titleAside={
          <button type="button" className="copy-key" onClick={copyKey} title="Copy task key">
            {task.key}
            <IconCopy size={12} />
          </button>
        }
        actions={
          <>
            <button className="btn btn--secondary" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            {isOwner && (
              <button className="btn btn--danger" onClick={handleDelete}>
                Delete
              </button>
            )}
          </>
        }
      />

      <div className="task-detail">
        <div className="task-detail__main">
          <h2 className="section-heading">Description</h2>
          {task.description ? (
            <p className="task-detail__description">{task.description}</p>
          ) : (
            <p className="task-detail__description task-detail__description--empty">
              No description yet.
            </p>
          )}
        </div>

        <aside className="meta-panel">
          <div className="meta-panel__row">
            <span className="meta-panel__label">
              <label htmlFor="task-status-inline">Status</label>
            </span>
            <select
              id="task-status-inline"
              className="inline-select"
              value={task.status}
              disabled={isSaving}
              onChange={(e) => patchTask({ status: e.target.value as TaskStatus })}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">
              <label htmlFor="task-priority-inline">Priority</label>
            </span>
            <select
              id="task-priority-inline"
              className="inline-select"
              value={task.priority}
              disabled={isSaving}
              onChange={(e) => patchTask({ priority: e.target.value as TaskPriority })}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">Assignee</span>
            <span className="meta-panel__value row-list__main">
              {task.assignee ? (
                <>
                  <Avatar name={task.assignee.full_name} size="sm" />
                  {task.assignee.full_name}
                </>
              ) : (
                'Unassigned'
              )}
            </span>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">Reporter</span>
            <span className="meta-panel__value row-list__main">
              <Avatar name={task.reporter.full_name} size="sm" />
              {task.reporter.full_name}
            </span>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">Sprint</span>
            <span className="meta-panel__value">{task.sprint_name ?? 'Backlog'}</span>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">Created</span>
            <span className="meta-panel__value" title={formatDateTime(task.created_at)}>
              {formatRelative(task.created_at)}
            </span>
          </div>

          <div className="meta-panel__row">
            <span className="meta-panel__label">Updated</span>
            <span className="meta-panel__value" title={formatDateTime(task.updated_at)}>
              {formatRelative(task.updated_at)}
            </span>
          </div>
        </aside>
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
    </>
  )
}
