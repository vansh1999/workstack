import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as workspacesApi from '../api/workspaces'
import type { InvitationPublic } from '../api/workspaces'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/Avatar'

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState<InvitationPublic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    if (!token) return
    workspacesApi
      .getInvitation(token)
      .then(setInvitation)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Invitation not found.'),
      )
      .finally(() => setIsLoading(false))
  }, [token])

  async function handleAccept() {
    if (!token) return
    setAcceptError(null)
    setIsAccepting(true)
    try {
      const result = await workspacesApi.acceptInvitation(token)
      navigate(`/workspaces/${result.workspace.id}`, { replace: true })
    } catch (err) {
      setAcceptError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) {
    return <p className="loading-state">Loading invitation…</p>
  }

  if (loadError || !invitation) {
    return <div className="error-banner">{loadError ?? 'Invitation not found.'}</div>
  }

  const emailMatches = user?.email.toLowerCase() === invitation.email.toLowerCase()

  return (
    <div className="auth-card">
      <div className="auth-card__header">
        <Avatar name={invitation.workspace_name} size="lg" />
        <h1 className="auth-card__title">You&apos;ve been invited to {invitation.workspace_name}</h1>
        <p className="auth-card__subtitle">Invited email: {invitation.email}</p>
      </div>

      {invitation.status === 'accepted' && (
        <div className="error-banner">This invitation has already been accepted.</div>
      )}
      {invitation.status === 'expired' && (
        <div className="error-banner">This invitation has expired.</div>
      )}
      {invitation.status === 'pending' && !emailMatches && (
        <div className="error-banner">
          This invitation was sent to {invitation.email}, but you&apos;re signed in as {user?.email}.
        </div>
      )}
      {invitation.status === 'pending' && emailMatches && (
        <>
          {acceptError && <div className="error-banner">{acceptError}</div>}
          <button className="btn" onClick={handleAccept} disabled={isAccepting}>
            {isAccepting ? 'Accepting…' : 'Accept invitation'}
          </button>
        </>
      )}
    </div>
  )
}
