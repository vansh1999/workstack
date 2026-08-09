import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import { ApiError } from '../api/client'

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

function statusBadgeClass(status: Sprint['status']): string {
  if (status === 'ACTIVE') return 'badge badge--active'
  if (status === 'COMPLETED') return 'badge badge--completed'
  return 'badge'
}

export function SprintsPage() {
  const { project } = useProject()
  const isOwner = project.role === 'OWNER'

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    sprintsApi
      .listSprints(project.id)
      .then(setSprints)
      .finally(() => setIsLoading(false))
  }, [project.id])

  function openForm() {
    setError(null)
    setName('')
    setGoal('')
    setStartDate('')
    setEndDate('')
    setIsFormOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const sprint = await sprintsApi.createSprint(project.id, {
        name,
        goal: goal || undefined,
        start_date: startDate,
        end_date: endDate,
      })
      setSprints((prev) => [...prev, sprint])
      setIsFormOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="projects">
      <div className="projects__header">
        <h2 className="onboarding__heading">Sprints</h2>
        {isOwner && !isFormOpen && (
          <button className="btn" onClick={openForm}>
            New sprint
          </button>
        )}
      </div>

      {isFormOpen && (
        <form className="form project-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-field">
            <label htmlFor="sprint-name">Name</label>
            <input
              id="sprint-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sprint-goal">Goal</label>
            <textarea
              id="sprint-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sprint-start-date">Start date</label>
            <input
              id="sprint-start-date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sprint-end-date">End date</label>
            <input
              id="sprint-end-date"
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
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create sprint'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="loading-state">Loading sprints…</p>
      ) : sprints.length === 0 ? (
        <p className="loading-state">No sprints yet.</p>
      ) : (
        <div className="project-grid">
          {sprints.map((sprint) => (
            <div key={sprint.id} className="sprint-card">
              <div className="sprint-card__header">
                <h3 className="project-card__title">{sprint.name}</h3>
                <span className={statusBadgeClass(sprint.status)}>{sprint.status}</span>
              </div>
              {sprint.goal && <p className="project-card__description">{sprint.goal}</p>}
              <p className="project-card__meta">
                {formatShortDate(sprint.start_date)} → {formatShortDate(sprint.end_date)}
              </p>
              <Link className="btn btn--secondary" to={`/projects/${project.id}/sprints/${sprint.id}`}>
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
