import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import * as projectsApi from '../api/projects'
import type { Project } from '../api/projects'
import { ApiError } from '../api/client'

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ProjectsPage() {
  const { workspace } = useWorkspace()
  const isOwner = workspace.role === 'OWNER'

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    projectsApi
      .listProjects(workspace.id)
      .then(setProjects)
      .finally(() => setIsLoading(false))
  }, [workspace.id])

  function openForm() {
    setError(null)
    setName('')
    setKey('')
    setDescription('')
    setIsFormOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const project = await projectsApi.createProject(workspace.id, name, key, description)
      setProjects((prev) => [...prev, project])
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
        <h1 className="dashboard__title">Projects</h1>
        {isOwner && !isFormOpen && (
          <button className="btn" onClick={openForm}>
            New project
          </button>
        )}
      </div>

      {isFormOpen && (
        <form className="form project-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-field">
            <label htmlFor="project-name">Name</label>
            <input
              id="project-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="project-key">Key</label>
            <input
              id="project-key"
              type="text"
              required
              maxLength={10}
              placeholder="e.g. PAY"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {isSubmitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="loading-state">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="loading-state">
          {isOwner
            ? 'No projects yet. Create the first one to get started.'
            : 'No projects yet.'}
        </p>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-card" to={`/projects/${project.id}`}>
              <div className="project-card__header">
                <h2 className="project-card__title">{project.name}</h2>
                <span className="badge">{project.key}</span>
              </div>
              {project.description && (
                <p className="project-card__description">{project.description}</p>
              )}
              <p className="project-card__meta">Created {formatDate(project.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
