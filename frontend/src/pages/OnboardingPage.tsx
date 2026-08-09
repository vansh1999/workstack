import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as workspacesApi from '../api/workspaces'
import type { Workspace } from '../api/workspaces'
import { ApiError } from '../api/client'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    workspacesApi
      .listWorkspaces()
      .then(setWorkspaces)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const workspace = await workspacesApi.createWorkspace(name)
      navigate(`/workspaces/${workspace.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <p className="loading-state">Loading…</p>
  }

  return (
    <div className="onboarding">
      {workspaces.length > 0 && (
        <div className="onboarding__section">
          <h2 className="onboarding__heading">Your workspaces</h2>
          <ul className="workspace-list">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link className="workspace-list__item" to={`/workspaces/${workspace.id}`}>
                  <span>{workspace.name}</span>
                  <span className="badge">{workspace.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="onboarding__section">
        <h2 className="onboarding__heading">Create a workspace</h2>
        {error && <div className="error-banner">{error}</div>}
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  )
}
