import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as tasksApi from '../api/tasks'
import type { Task } from '../api/tasks'
import { ApiError } from '../api/client'
import { useResourceById } from '../hooks/useResourceById'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows, Skeleton } from '../components/Skeleton'
import { Modal } from '../components/Modal'
import { PriorityBadge, SprintStatusBadge, TaskStatusBadge } from '../components/Badge'
import { IconAlert, IconInbox } from '../components/icons'
import { formatDate, describeSprintTiming } from '../lib/dates'
import { MIN_SPRINT_DATE, validateSprintDates } from '../lib/sprints'

export function SprintDetailPage() {
  const { sprintId } = useParams<{ sprintId: string }>()
  const { project } = useProject()
  const isOwner = project.role === 'OWNER'

  const {
    value: sprint,
    isPending,
    isNotFound,
    error: loadError,
    setValue: setSprint,
  } = useResourceById<Sprint>(
    sprintId,
    sprintsApi.getSprint,
    'Could not load this sprint. Please try again.',
  )

  const [tasks, setTasks] = useState<Task[] | null>(null)
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

    let cancelled = false
    setTasks(null)
    tasksApi
      .listTasks(project.id, { sprintId })
      .then((result) => {
        if (!cancelled) setTasks(result)
      })
      .catch(() => {
        if (!cancelled) setTasks([])
      })

    return () => {
      cancelled = true
    }
  }, [project.id, sprintId])

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

    const dateError = validateSprintDates(startDate, endDate)
    if (dateError) {
      setError(dateError)
      return
    }

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

  async function runTransition(action: (id: string) => Promise<Sprint>) {
    if (!sprint) return
    setActionError(null)
    setIsTransitioning(true)
    try {
      setSprint(await action(sprint.id))
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsTransitioning(false)
    }
  }

  if (isNotFound) {
    return <Navigate to={`/projects/${project.id}/sprints`} replace />
  }

  if (loadError) {
    return <div className="error-banner">{loadError}</div>
  }

  if (isPending || !sprint) {
    return (
      <div className="stack">
        <Skeleton width="200px" height="22px" />
        <Skeleton width="320px" />
      </div>
    )
  }

  const doneCount = tasks?.filter((task) => task.status === 'DONE').length ?? 0
  const percent = tasks && tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div className="stack stack--lg">
      <PageHeader
        as="h2"
        title={sprint.name}
        titleAside={<SprintStatusBadge status={sprint.status} />}
        description={sprint.goal ?? undefined}
        backTo={`/projects/${project.id}/sprints`}
        backLabel="Sprints"
        actions={
          isOwner && sprint.status !== 'COMPLETED' ? (
            <>
              <button className="btn btn--secondary" onClick={startEditing}>
                Edit
              </button>
              {sprint.status === 'PLANNED' && (
                <button
                  className="btn"
                  onClick={() => runTransition(sprintsApi.startSprint)}
                  disabled={isTransitioning}
                >
                  {isTransitioning && <span className="spinner" />}
                  {isTransitioning ? 'Starting…' : 'Start Sprint'}
                </button>
              )}
              {sprint.status === 'ACTIVE' && (
                <button
                  className="btn"
                  onClick={() => runTransition(sprintsApi.completeSprint)}
                  disabled={isTransitioning}
                >
                  {isTransitioning && <span className="spinner" />}
                  {isTransitioning ? 'Completing…' : 'Complete Sprint'}
                </button>
              )}
            </>
          ) : null
        }
      />

      {actionError && (
        <div className="error-banner">
          <IconAlert size={15} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <span className="stat__label">Dates</span>
          <span className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
            {formatDate(sprint.start_date)}
          </span>
          <span className="stat__meta">to {formatDate(sprint.end_date)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Timing</span>
          <span className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
            {describeSprintTiming(sprint)}
          </span>
          {sprint.status === 'COMPLETED' && (
            <span className="stat__meta">This sprint is complete.</span>
          )}
        </div>
        <div className="stat">
          <span className="stat__label">Progress</span>
          <span className="stat__value">
            {tasks ? `${doneCount}/${tasks.length}` : <Skeleton width="48px" height="26px" />}
          </span>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sprint progress"
          >
            <div className="progress__fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <section className="stack">
        <h3 className="section-heading">Tasks</h3>
        {tasks === null ? (
          <SkeletonRows count={3} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={20} />}
            title="No tasks in this sprint yet."
            body="Move work into this sprint from the board, or create a task assigned to it."
            inline
          />
        ) : (
          <div className="row-list">
            {tasks.map((task) => (
              <Link key={task.id} className="row-list__item" to={`/tasks/${task.id}`}>
                <span className="row-list__main">
                  <span className="key-chip">{task.key}</span>
                  <span className="row-list__text">
                    <span className="row-list__title">{task.title}</span>
                    <span className="row-list__subtitle">
                      {task.assignee?.full_name ?? 'Unassigned'}
                    </span>
                  </span>
                </span>
                <span className="row-list__aside">
                  <PriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isEditing && (
        <Modal title="Edit sprint" onClose={() => setIsEditing(false)}>
          <form className="form" onSubmit={handleSave}>
            {error && (
              <div className="error-banner">
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}
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
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="edit-sprint-start-date">Start date</label>
                <input
                  id="edit-sprint-start-date"
                  type="date"
                  required
                  min={MIN_SPRINT_DATE}
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
