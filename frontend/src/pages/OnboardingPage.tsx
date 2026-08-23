import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as workspacesApi from '../api/workspaces'
import type { Workspace } from '../api/workspaces'
import { ApiError } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/Avatar'
import { RoleBadge } from '../components/Badge'
import { SkeletonRows } from '../components/Skeleton'
import { IconAlert, IconArrowRight } from '../components/icons'

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

  return (
    <div style={{ maxWidth: '560px' }}>
      <PageHeader
        title="Workspaces"
        description="A workspace holds your projects, sprints, and teammates."
      />

      <div className="stack stack--lg">
        {isLoading ? (
          <SkeletonRows count={2} />
        ) : (
          workspaces.length > 0 && (
            <section className="stack">
              <h2 className="section-heading">Your workspaces</h2>
              <div className="row-list">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    className="row-list__item"
                    to={`/workspaces/${workspace.id}`}
                  >
                    <span className="row-list__main">
                      <Avatar name={workspace.name} />
                      <span className="row-list__title">{workspace.name}</span>
                    </span>
                    <span className="row-list__aside">
                      <RoleBadge role={workspace.role} />
                      <IconArrowRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )
        )}

        <section className="stack">
          <h2 className="section-heading">Create a workspace</h2>
          {error && (
            <div className="error-banner">
              <IconAlert size={15} />
              <span>{error}</span>
            </div>
          )}
          <form className="form form--inline" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                type="text"
                required
                placeholder="e.g. Acme Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting && <span className="spinner" />}
              {isSubmitting ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
