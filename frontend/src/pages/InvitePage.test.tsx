import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, vi } from 'vitest'
import { InvitePage } from './InvitePage'
import { AuthProvider } from '../context/AuthContext'
import * as authApi from '../api/auth'
import * as workspacesApi from '../api/workspaces'

vi.mock('../api/auth')
vi.mock('../api/workspaces')

function renderInvitePage(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/workspaces/:workspaceId" element={<div>Workspace Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const CURRENT_USER = {
  id: 'u1',
  email: 'invitee@example.com',
  full_name: 'Invitee',
  created_at: 'now',
}

beforeEach(() => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(CURRENT_USER)
})

describe('InvitePage', () => {
  it('shows workspace name and invited email, and accepts a matching pending invitation', async () => {
    vi.mocked(workspacesApi.getInvitation).mockResolvedValue({
      workspace_name: 'Acme',
      email: 'invitee@example.com',
      status: 'pending',
    })
    vi.mocked(workspacesApi.acceptInvitation).mockResolvedValue({
      workspace: { id: 'w1', name: 'Acme', role: 'MEMBER', created_at: 'now' },
    })

    renderInvitePage()

    expect(await screen.findByText(/Acme/)).toBeInTheDocument()
    expect(screen.getByText(/invitee@example.com/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /accept invitation/i }))

    expect(await screen.findByText('Workspace Page')).toBeInTheDocument()
  })

  it('warns when the signed-in email does not match the invitation', async () => {
    vi.mocked(workspacesApi.getInvitation).mockResolvedValue({
      workspace_name: 'Acme',
      email: 'someone-else@example.com',
      status: 'pending',
    })

    renderInvitePage()

    expect(await screen.findByText(/sent to someone-else@example.com/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept invitation/i })).not.toBeInTheDocument()
  })

  it('shows an expired message and no accept button', async () => {
    vi.mocked(workspacesApi.getInvitation).mockResolvedValue({
      workspace_name: 'Acme',
      email: 'invitee@example.com',
      status: 'expired',
    })

    renderInvitePage()

    expect(await screen.findByText(/expired/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept invitation/i })).not.toBeInTheDocument()
  })
})
