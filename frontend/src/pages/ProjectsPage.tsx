import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import * as projectsApi from '../api/projects'
import type { Project } from '../api/projects'
import { ApiError } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCards } from '../components/Skeleton'
import { Modal } from '../components/Modal'
import { Avatar } from '../components/Avatar'
import { IconAlert, IconArrowRight, IconLayers, IconPlus } from '../components/icons'

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

  const newProjectButton = isOwner ? (
    <button className="btn" onClick={openForm}>
      <IconPlus size={15} />
      New project
    </button>
  ) : null

  return (
    <>
      <PageHeader
        title="Projects"
        description={`Everything being built in ${workspace.name}.`}
        actions={newProjectButton}
      />

      {isLoading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={20} />}
          title="No projects yet."
          body={
            isOwner
              ? 'Use New project above to start planning sprints and tracking work.'
              : 'An owner of this workspace needs to create one first.'
          }
        />
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-card" to={`/projects/${project.id}`}>
              <div className="project-card__header">
                <div className="row-list__main">
                  <Avatar name={project.name} label={project.key.slice(0, 2)} />
                  <h2 className="project-card__title">{project.name}</h2>
                </div>
                <span className="key-chip">{project.key}</span>
              </div>
              {project.description && (
                <p className="project-card__description">{project.description}</p>
              )}
              <p className="project-card__meta">
                <span>Created {formatDate(project.created_at)}</span>
                <IconArrowRight size={15} className="project-card__arrow" />
              </p>
            </Link>
          ))}
        </div>
      )}

      {isFormOpen && (
        <Modal title="New project" onClose={() => setIsFormOpen(false)}>
          <form className="form" onSubmit={handleSubmit}>
            {error && (
              <div className="error-banner">
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}
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
              <span className="form-field__hint">
                Used to prefix every task in this project, like PAY-12.
              </span>
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
                {isSubmitting ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
