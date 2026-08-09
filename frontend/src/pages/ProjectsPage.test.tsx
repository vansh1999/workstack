import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ProjectsPage } from './ProjectsPage'
import { WorkspaceContext } from '../context/WorkspaceContext'
import * as projectsApi from '../api/projects'
import type { WorkspaceRole } from '../api/workspaces'

vi.mock('../api/projects')

function renderProjectsPage(role: WorkspaceRole) {
  return render(
    <MemoryRouter>
      <WorkspaceContext.Provider
        value={{
          workspace: { id: 'w1', name: 'Acme', role, created_at: 'now' },
          members: [],
          isLoadingMembers: false,
          refreshMembers: vi.fn(),
        }}
      >
        <ProjectsPage />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  )
}

describe('ProjectsPage', () => {
  it('lists projects belonging to the workspace', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      {
        id: 'p1',
        workspace_id: 'w1',
        workspace_name: 'Acme',
        name: 'Payment Platform',
        key: 'PAY',
        description: 'Payment infrastructure and services',
        role: 'OWNER',
        created_at: '2026-08-09T00:00:00Z',
        updated_at: '2026-08-09T00:00:00Z',
      },
    ])

    renderProjectsPage('OWNER')

    expect(await screen.findByText('Payment Platform')).toBeInTheDocument()
    expect(screen.getByText('Payment infrastructure and services')).toBeInTheDocument()
  })

  it('shows an empty state when there are no projects', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])

    renderProjectsPage('OWNER')

    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('shows the "New project" action for owners and lets them create one', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(projectsApi.createProject).mockResolvedValue({
      id: 'p2',
      workspace_id: 'w1',
      workspace_name: 'Acme',
      name: 'Mobile App',
      key: 'MOB',
      description: '',
      role: 'OWNER',
      created_at: '2026-08-09T00:00:00Z',
      updated_at: '2026-08-09T00:00:00Z',
    })

    renderProjectsPage('OWNER')

    await screen.findByText(/no projects yet/i)
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText('Name'), 'Mobile App')
    await userEvent.type(screen.getByLabelText('Key'), 'MOB')
    await userEvent.click(screen.getByRole('button', { name: /create project/i }))

    expect(await screen.findByText('Mobile App')).toBeInTheDocument()
  })

  it('hides the "New project" action for members', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])

    renderProjectsPage('MEMBER')

    await screen.findByText(/no projects yet/i)
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument()
  })
})
