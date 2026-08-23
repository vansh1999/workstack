import { useState } from 'react'
import type { FormEvent } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import * as workspacesApi from '../api/workspaces'
import { ApiError } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/Avatar'
import { RoleBadge } from '../components/Badge'
import { SkeletonRows } from '../components/Skeleton'
import { IconAlert, IconCopy } from '../components/icons'

export function MembersPage() {
  const { workspace, members, isLoadingMembers, refreshMembers } = useWorkspace()
  const toast = useToast()
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

  async function copyInviteUrl() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.show('Invite link copied to clipboard.', 'success')
    } catch {
      toast.show('Could not copy the link. Select and copy it manually.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Members"
        description={`People with access to ${workspace.name}.`}
      />

      <div className="stack stack--lg">
        {isLoadingMembers ? (
          <SkeletonRows count={3} />
        ) : (
          <div className="row-list">
            {members.map((member) => (
              <div key={member.id} className="row-list__item">
                <div className="row-list__main">
                  <Avatar name={member.user.full_name || member.user.email} />
                  <div className="row-list__text">
                    <span className="row-list__title">{member.user.full_name}</span>
                    <span className="row-list__subtitle">{member.user.email}</span>
                  </div>
                </div>
                <div className="row-list__aside">
                  <RoleBadge role={member.role} />
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <section className="stack">
            <h2 className="section-heading">Invite a member</h2>
            {error && (
              <div className="error-banner">
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}
            <form className="form form--inline" onSubmit={handleInvite}>
              <div className="form-field">
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting && <span className="spinner" />}
                {isSubmitting ? 'Sending…' : 'Send invite'}
              </button>
            </form>

            {inviteUrl && (
              <div className="copy-row">
                <code>{inviteUrl}</code>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={copyInviteUrl}
                >
                  <IconCopy size={14} />
                  Copy
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}
