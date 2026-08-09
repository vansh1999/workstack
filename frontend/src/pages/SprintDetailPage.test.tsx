import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { SprintDetailPage } from './SprintDetailPage'
import { ProjectContext } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import type { WorkspaceRole } from '../api/workspaces'

vi.mock('../api/sprints')

const BASE_SPRINT: Sprint = {
  id: 's1',
  project_id: 'p1',
  name: 'Sprint 1',
  goal: 'Complete authentication',
  start_date: '2026-08-10',
  end_date: '2026-08-23',
  status: 'PLANNED',
  created_at: 'now',
  updated_at: 'now',
}

function renderSprintDetail(role: WorkspaceRole) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1/sprints/s1']}>
      <ProjectContext.Provider
        value={{
          project: {
            id: 'p1',
            workspace_id: 'w1',
            workspace_name: 'Acme',
            name: 'Payment Platform',
            key: 'PAY',
            description: '',
            role,
            created_at: 'now',
            updated_at: 'now',
          },
          setProject: vi.fn(),
        }}
      >
        <Routes>
          <Route path="/projects/:projectId/sprints/:sprintId" element={<SprintDetailPage />} />
        </Routes>
      </ProjectContext.Provider>
    </MemoryRouter>,
  )
}

describe('SprintDetailPage', () => {
  it('shows sprint name, goal, status, and dates', async () => {
    vi.mocked(sprintsApi.getSprint).mockResolvedValue(BASE_SPRINT)

    renderSprintDetail('OWNER')

    expect(await screen.findByText('Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('Complete authentication')).toBeInTheDocument()
    expect(screen.getByText('PLANNED')).toBeInTheDocument()
    expect(screen.getByText('No tasks in this sprint yet.')).toBeInTheDocument()
  })

  it('shows Edit and Start Sprint for a PLANNED sprint, owner only', async () => {
    vi.mocked(sprintsApi.getSprint).mockResolvedValue(BASE_SPRINT)
    vi.mocked(sprintsApi.startSprint).mockResolvedValue({ ...BASE_SPRINT, status: 'ACTIVE' })

    renderSprintDetail('OWNER')

    await screen.findByText('Sprint 1')
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /start sprint/i }))

    expect(await screen.findByText('ACTIVE')).toBeInTheDocument()
  })

  it('shows Complete Sprint for an ACTIVE sprint', async () => {
    vi.mocked(sprintsApi.getSprint).mockResolvedValue({ ...BASE_SPRINT, status: 'ACTIVE' })
    vi.mocked(sprintsApi.completeSprint).mockResolvedValue({ ...BASE_SPRINT, status: 'COMPLETED' })

    renderSprintDetail('OWNER')

    await screen.findByText('Sprint 1')
    await userEvent.click(screen.getByRole('button', { name: /complete sprint/i }))

    expect(await screen.findByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText(/this sprint is complete/i)).toBeInTheDocument()
  })

  it('hides all actions for a COMPLETED sprint', async () => {
    vi.mocked(sprintsApi.getSprint).mockResolvedValue({ ...BASE_SPRINT, status: 'COMPLETED' })

    renderSprintDetail('OWNER')

    await screen.findByText('Sprint 1')
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start sprint/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete sprint/i })).not.toBeInTheDocument()
  })

  it('hides Edit/Start/Complete actions for members', async () => {
    vi.mocked(sprintsApi.getSprint).mockResolvedValue(BASE_SPRINT)

    renderSprintDetail('MEMBER')

    await screen.findByText('Sprint 1')
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start sprint/i })).not.toBeInTheDocument()
  })
})
