import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as projectsApi from '../api/projects'
import { ApiError } from '../api/client'
import { useProject } from '../context/ProjectContext'

export function ProjectOverviewPage() {
  const { project, setProject } = useProject()
  const navigate = useNavigate()
  const isOwner = project.role === 'OWNER'

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  if (isEditing) {
    return (
      <form className="form" onSubmit={handleSave}>
        {error && <div className="error-banner">{error}</div>}
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
    <div className="project-page__header">
      <p className="dashboard__subtitle">{project.description || 'No description yet.'}</p>
      {isOwner && (
        <div className="project-page__actions">
          <button className="btn btn--secondary" onClick={startEditing}>
            Edit
          </button>
          <button className="btn btn--danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
