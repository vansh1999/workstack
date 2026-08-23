import { useState } from 'react'
import type { FormEvent } from 'react'
import * as tasksApi from '../api/tasks'
import type { Task, TaskPriority, TaskStatus } from '../api/tasks'
import { ApiError } from '../api/client'
import type { WorkspaceMember } from '../api/workspaces'
import type { Sprint } from '../api/sprints'
import { Modal } from './Modal'
import { IconAlert } from './icons'

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE']
const BACKLOG_VALUE = 'backlog'

interface TaskFormModalProps {
  mode: 'create' | 'edit'
  projectId: string
  members: WorkspaceMember[]
  sprints: Sprint[]
  task?: Task
  defaultSprintId?: string | null
  /** Column the task is being created into. */
  defaultStatus?: TaskStatus
  onClose: () => void
  onSaved: (task: Task) => void
}

export function TaskFormModal({
  mode,
  projectId,
  members,
  sprints,
  task,
  defaultSprintId,
  defaultStatus,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM')
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? '')
  const [sprintChoice, setSprintChoice] = useState(
    task?.sprint_id ?? defaultSprintId ?? BACKLOG_VALUE,
  )
  // A task created into a sprint is TODO, not BACKLOG — mirror the server so the two selects
  // never start out contradicting each other.
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? defaultStatus ?? (defaultSprintId ? 'TODO' : 'BACKLOG'),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const sprintId = sprintChoice === BACKLOG_VALUE ? null : sprintChoice

    try {
      let saved: Task
      if (mode === 'create') {
        saved = await tasksApi.createTask(projectId, {
          title,
          description: description || undefined,
          priority,
          assignee_id: assigneeId || undefined,
          sprint_id: sprintId ?? undefined,
        })
        // Creation does not accept a status, so a task started in a specific column is moved
        // there straight after.
        if (status !== saved.status) {
          saved = await tasksApi.updateTask(saved.id, { status })
        }
      } else {
        if (!task) throw new Error('Missing task to edit')
        saved = await tasksApi.updateTask(task.id, {
          title,
          description: description || null,
          priority,
          status,
          assignee_id: assigneeId || null,
          sprint_id: sprintId,
        })
      }
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'New task' : 'Edit task'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-banner">
            <IconAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="task-description">Description</label>
          <textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="task-sprint">Sprint</label>
            <select
              id="task-sprint"
              value={sprintChoice}
              onChange={(e) => {
                const next = e.target.value
                setSprintChoice(next)
                // The API rejects a sprint on a BACKLOG task, and any other status without a
                // sprint — keep the pair valid instead of letting the user submit into a 422.
                if (next === BACKLOG_VALUE) setStatus('BACKLOG')
                else if (status === 'BACKLOG') setStatus('TODO')
              }}
            >
              <option value={BACKLOG_VALUE}>Backlog (no sprint)</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting && <span className="spinner" />}
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create task' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
