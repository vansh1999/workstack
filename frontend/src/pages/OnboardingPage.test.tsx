import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'
import * as workspacesApi from '../api/workspaces'

vi.mock('../api/workspaces')

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/workspaces/:workspaceId" element={<div>Workspace Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OnboardingPage', () => {
  it('shows existing workspaces and lets the user create a new one', async () => {
    vi.mocked(workspacesApi.listWorkspaces).mockResolvedValue([
      { id: 'w1', name: 'Acme', role: 'OWNER', created_at: 'now' },
    ])
    vi.mocked(workspacesApi.createWorkspace).mockResolvedValue({
      id: 'w2',
      name: 'New Co',
      role: 'OWNER',
      created_at: 'now',
    })

    renderOnboarding()

    expect(await screen.findByText('Acme')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Workspace name'), 'New Co')
    await userEvent.click(screen.getByRole('button', { name: /create workspace/i }))

    expect(await screen.findByText('Workspace Page')).toBeInTheDocument()
    expect(workspacesApi.createWorkspace).toHaveBeenCalledWith('New Co')
  })

  it('shows only the create form when the user has no workspaces', async () => {
    vi.mocked(workspacesApi.listWorkspaces).mockResolvedValue([])

    renderOnboarding()

    await screen.findByLabelText('Workspace name')
    expect(screen.queryByText('Your workspaces')).not.toBeInTheDocument()
  })
})
