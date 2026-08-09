import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { MembersPage } from './MembersPage'
import { WorkspaceContext } from '../context/WorkspaceContext'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceRole } from '../api/workspaces'

vi.mock('../api/workspaces')

const OWNER_MEMBER = {
  id: 'm1',
  role: 'OWNER' as const,
  created_at: 'now',
  user: { id: 'u1', email: 'owner@example.com', full_name: 'Owner Person', created_at: 'now' },
}

function renderMembersPage(role: WorkspaceRole) {
  return render(
    <MemoryRouter>
      <WorkspaceContext.Provider
        value={{
          workspace: { id: 'w1', name: 'Acme', role, created_at: 'now' },
          members: [OWNER_MEMBER],
          isLoadingMembers: false,
          refreshMembers: vi.fn(),
        }}
      >
        <MembersPage />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  )
}

describe('MembersPage', () => {
  it('lists members', () => {
    renderMembersPage('OWNER')

    expect(screen.getByText('Owner Person')).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
  })

  it('shows the invite form for owners and creates an invitation', async () => {
    vi.mocked(workspacesApi.createInvitation).mockResolvedValue({
      id: 'inv1',
      workspace_id: 'w1',
      email: 'invitee@example.com',
      expires_at: 'later',
      created_at: 'now',
      invite_url: 'http://localhost:5173/invite/abc123',
    })

    renderMembersPage('OWNER')

    await userEvent.type(screen.getByLabelText('Email'), 'invitee@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(await screen.findByText('http://localhost:5173/invite/abc123')).toBeInTheDocument()
  })

  it('hides the invite form for non-owner members', () => {
    renderMembersPage('MEMBER')

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})
