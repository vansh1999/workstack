import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as tasksApi from '../api/tasks'
import { ApiError } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCards } from '../components/Skeleton'
import { Modal } from '../components/Modal'
import { SprintStatusBadge } from '../components/Badge'
import { IconAlert, IconPlus, IconSprint } from '../components/icons'
import { formatShortDate, describeSprintTiming } from '../lib/dates'
import { byMostRecent, MIN_SPRINT_DATE, validateSprintDates } from '../lib/sprints'

interface SprintProgress {
  done: number
  total: number
}

export function SprintsPage() {
  const { project } = useProject()
  const isOwner = project.role === 'OWNER'

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [progressBySprint, setProgressBySprint] = useState<Record<string, SprintProgress>>({})
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

  // One request for the whole project, grouped client-side — cheaper than a call per sprint, and
  // the progress bars are a summary, so a failure just leaves them out.
  useEffect(() => {
    let cancelled = false
    tasksApi
      .listTasks(project.id)
      .then((tasks) => {
        if (cancelled) return
        const grouped: Record<string, SprintProgress> = {}
        for (const task of tasks) {
          if (!task.sprint_id) continue
          const entry = (grouped[task.sprint_id] ??= { done: 0, total: 0 })
          entry.total += 1
          if (task.status === 'DONE') entry.done += 1
        }
        setProgressBySprint(grouped)
      })
      .catch(() => {
        if (!cancelled) setProgressBySprint({})
      })

    return () => {
      cancelled = true
    }
  }, [project.id])

  const orderedSprints = useMemo(() => [...sprints].sort(byMostRecent), [sprints])

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

    const dateError = validateSprintDates(startDate, endDate)
    if (dateError) {
      setError(dateError)
      return
    }

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
    <>
      <PageHeader
        as="h2"
        title="Sprints"
        description="Time-boxed blocks of work, from planning through to completion."
        actions={
          isOwner ? (
            <button className="btn" onClick={openForm}>
              <IconPlus size={15} />
              New sprint
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <SkeletonCards count={2} />
      ) : orderedSprints.length === 0 ? (
        <EmptyState
          icon={<IconSprint size={20} />}
          title="No sprints yet."
          body={
            isOwner
              ? 'Create a sprint to start scheduling work on the board.'
              : 'An owner needs to create the first sprint.'
          }
        />
      ) : (
        <div className="project-grid">
          {orderedSprints.map((sprint) => {
            const progress = progressBySprint[sprint.id]
            const percent =
              progress && progress.total > 0
                ? Math.round((progress.done / progress.total) * 100)
                : 0

            return (
              <Link
                key={sprint.id}
                className="sprint-card"
                to={`/projects/${project.id}/sprints/${sprint.id}`}
              >
                <div className="sprint-card__header">
                  <h3 className="sprint-card__title">{sprint.name}</h3>
                  <SprintStatusBadge status={sprint.status} />
                </div>

                {sprint.goal && <p className="sprint-card__goal">{sprint.goal}</p>}

                {progress && progress.total > 0 && (
                  <div className="progress-block">
                    <div className="progress-block__labels">
                      <span>
                        {progress.done} of {progress.total} done
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${sprint.name} progress`}
                    >
                      <div
                        className={`progress__fill${sprint.status === 'COMPLETED' ? ' progress__fill--green' : ''}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="sprint-card__footer">
                  <span>
                    {formatShortDate(sprint.start_date)} → {formatShortDate(sprint.end_date)}
                  </span>
                  <span>{describeSprintTiming(sprint)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {isFormOpen && (
        <Modal title="New sprint" onClose={() => setIsFormOpen(false)}>
          <form className="form" onSubmit={handleSubmit}>
            {error && (
              <div className="error-banner">
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="sprint-name">Name</label>
              <input
                id="sprint-name"
                type="text"
                required
                placeholder="e.g. Sprint 4"
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
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="sprint-start-date">Start date</label>
                <input
                  id="sprint-start-date"
                  type="date"
                  required
                  min={MIN_SPRINT_DATE}
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
                  min={startDate || MIN_SPRINT_DATE}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting && <span className="spinner" />}
                {isSubmitting ? 'Creating…' : 'Create sprint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
