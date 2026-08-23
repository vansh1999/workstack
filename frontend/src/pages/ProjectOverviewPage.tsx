import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as projectsApi from '../api/projects'
import * as sprintsApi from '../api/sprints'
import * as tasksApi from '../api/tasks'
import * as workspacesApi from '../api/workspaces'
import type { Sprint } from '../api/sprints'
import type { Task } from '../api/tasks'
import { ApiError } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { SprintStatusBadge } from '../components/Badge'
import { IconAlert, IconBoard, IconSprint, IconUsers } from '../components/icons'

interface Overview {
  tasks: Task[]
  sprints: Sprint[]
  memberCount: number
}

export function ProjectOverviewPage() {
  const { project, setProject } = useProject()
  const navigate = useNavigate()
  const isOwner = project.role === 'OWNER'

  const [overview, setOverview] = useState<Overview | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Summary only — a failure here must not take the tab down with it.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      tasksApi.listTasks(project.id),
      sprintsApi.listSprints(project.id),
      workspacesApi.listMembers(project.workspace_id),
    ])
      .then(([tasks, sprints, members]) => {
        if (!cancelled) setOverview({ tasks, sprints, memberCount: members.length })
      })
      .catch(() => {
        if (!cancelled) setOverview({ tasks: [], sprints: [], memberCount: 0 })
      })

    return () => {
      cancelled = true
    }
  }, [project.id, project.workspace_id])

  function startEditing() {
    setError(null)
    setName(project.name)
    setDescription(project.description ?? '')
    setIsEditing(true)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const updated = await projectsApi.updateProject(project.id, {
        name,
        description: description || null,
      })
      setProject(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    await projectsApi.deleteProject(project.id)
    navigate(`/workspaces/${project.workspace_id}`, { replace: true })
  }

  const openTasks = overview?.tasks.filter((task) => task.status !== 'DONE').length ?? 0
  const doneTasks = overview ? overview.tasks.length - openTasks : 0
  const activeSprint = overview?.sprints.find((sprint) => sprint.status === 'ACTIVE') ?? null

  return (
    <div className="stack stack--lg">
      <div className="page-header">
        <p className="page-header__description">
          {project.description || 'No description yet.'}
        </p>
        {isOwner && (
          <div className="page-header__actions">
            <button className="btn btn--secondary" onClick={startEditing}>
              Edit
            </button>
            <button className="btn btn--danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat__label">
            <IconBoard size={13} />
            Open tasks
          </span>
          {overview ? (
            <>
              <span className="stat__value">{openTasks}</span>
              <span className="stat__meta">{doneTasks} done</span>
            </>
          ) : (
            <Skeleton width="48px" height="26px" />
          )}
        </div>

        <div className="stat">
          <span className="stat__label">
            <IconSprint size={13} />
            Active sprint
          </span>
          {overview ? (
            activeSprint ? (
              <>
                <span className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
                  {activeSprint.name}
                </span>
                <span className="stat__meta">
                  <SprintStatusBadge status={activeSprint.status} />
                </span>
              </>
            ) : (
              <>
                <span className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
                  None
                </span>
                <span className="stat__meta">{overview.sprints.length} sprints planned</span>
              </>
            )
          ) : (
            <Skeleton width="90px" height="26px" />
          )}
        </div>

        <div className="stat">
          <span className="stat__label">
            <IconUsers size={13} />
            Members
          </span>
          {overview ? (
            <>
              <span className="stat__value">{overview.memberCount}</span>
              <span className="stat__meta">in {project.workspace_name}</span>
            </>
          ) : (
            <Skeleton width="48px" height="26px" />
          )}
        </div>
      </div>

      {isEditing && (
        <Modal title="Edit project" onClose={() => setIsEditing(false)}>
          <form className="form" onSubmit={handleSave}>
            {error && (
              <div className="error-banner">
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="edit-project-name">Name</label>
              <input
                id="edit-project-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-project-description">Description</label>
              <textarea
                id="edit-project-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting && <span className="spinner" />}
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
