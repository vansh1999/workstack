import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import { ApiError } from '../api/client'

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusBadgeClass(status: Sprint['status']): string {
  if (status === 'ACTIVE') return 'badge badge--active'
  if (status === 'COMPLETED') return 'badge badge--completed'
  return 'badge'
}

export function SprintDetailPage() {
  const { sprintId } = useParams<{ sprintId: string }>()
  const { project } = useProject()
  const isOwner = project.role === 'OWNER'

  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (!sprintId) return
    sprintsApi
      .getSprint(sprintId)
      .then(setSprint)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
      })
      .finally(() => setIsLoading(false))
  }, [sprintId])

  function startEditing() {
    if (!sprint) return
    setError(null)
    setName(sprint.name)
    setGoal(sprint.goal ?? '')
    setStartDate(sprint.start_date)
    setEndDate(sprint.end_date)
    setIsEditing(true)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!sprint) return
    setError(null)
    setIsSubmitting(true)
    try {
      const updated = await sprintsApi.updateSprint(sprint.id, {
        name,
        goal: goal || null,
        start_date: startDate,
        end_date: endDate,
      })
      setSprint(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStart() {
    if (!sprint) return
    setActionError(null)
    setIsTransitioning(true)
    try {
      setSprint(await sprintsApi.startSprint(sprint.id))
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsTransitioning(false)
    }
  }

  async function handleComplete() {
    if (!sprint) return
    setActionError(null)
    setIsTransitioning(true)
    try {
      setSprint(await sprintsApi.completeSprint(sprint.id))
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsTransitioning(false)
    }
  }

  if (isLoading) {
    return <p className="loading-state">Loading sprint…</p>
  }

  if (notFound || !sprint) {
    return <Navigate to={`/projects/${project.id}/sprints`} replace />
  }

  if (isEditing) {
    return (
      <form className="form" onSubmit={handleSave}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-field">
          <label htmlFor="edit-sprint-name">Name</label>
          <input
            id="edit-sprint-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="edit-sprint-goal">Goal</label>
          <textarea
            id="edit-sprint-goal"
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="edit-sprint-start-date">Start date</label>
          <input
            id="edit-sprint-start-date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="edit-sprint-end-date">End date</label>
          <input
            id="edit-sprint-end-date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="project-form__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setIsEditing(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="sprint-detail">
      <div className="sprint-detail__header">
        <h2 className="onboarding__heading">{sprint.name}</h2>
        <span className={statusBadgeClass(sprint.status)}>{sprint.status}</span>
      </div>

      {sprint.goal && <p className="dashboard__subtitle">{sprint.goal}</p>}
      <p className="project-card__meta">
        {formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}
      </p>

      {actionError && <div className="error-banner">{actionError}</div>}

      {isOwner && sprint.status !== 'COMPLETED' && (
        <div className="project-form__actions">
          <button className="btn btn--secondary" onClick={startEditing}>
            Edit
          </button>
          {sprint.status === 'PLANNED' && (
            <button className="btn" onClick={handleStart} disabled={isTransitioning}>
              {isTransitioning ? 'Starting…' : 'Start Sprint'}
            </button>
          )}
          {sprint.status === 'ACTIVE' && (
            <button className="btn" onClick={handleComplete} disabled={isTransitioning}>
              {isTransitioning ? 'Completing…' : 'Complete Sprint'}
            </button>
          )}
        </div>
      )}

      {sprint.status === 'COMPLETED' && (
        <p className="loading-state">This sprint is complete.</p>
      )}

      <div className="sprint-detail__tasks">
        <h3 className="onboarding__heading">Tasks</h3>
        <p className="loading-state">No tasks in this sprint yet.</p>
      </div>
    </div>
  )
}
