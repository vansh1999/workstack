import { useState } from 'react'
import type { FormEvent } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import * as workspacesApi from '../api/workspaces'
import { ApiError } from '../api/client'

export function MembersPage() {
  const { workspace, members, isLoadingMembers, refreshMembers } = useWorkspace()
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOwner = workspace.role === 'OWNER'

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInviteUrl(null)
    setIsSubmitting(true)
    try {
      const invitation = await workspacesApi.createInvitation(workspace.id, email)
      setInviteUrl(invitation.invite_url)
      setEmail('')
      await refreshMembers()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">{workspace.name} · Members</h1>

      {isLoadingMembers ? (
        <p className="loading-state">Loading members…</p>
      ) : (
        <ul className="member-list">
          {members.map((member) => (
            <li key={member.id} className="member-list__item">
              <div>
                <div>{member.user.full_name}</div>
                <div className="member-list__email">{member.user.email}</div>
              </div>
              <span className="badge">{member.role}</span>
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <div className="onboarding__section">
          <h2 className="onboarding__heading">Invite a member</h2>
          {error && <div className="error-banner">{error}</div>}
          {inviteUrl && (
            <div className="invite-url-box">
              Invitation created. Share this link:
              <code>{inviteUrl}</code>
            </div>
          )}
          <form className="form form--inline" onSubmit={handleInvite}>
            <div className="form-field">
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
