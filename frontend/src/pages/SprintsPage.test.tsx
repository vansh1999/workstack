import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { SprintsPage } from './SprintsPage'
import { ProjectContext } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import * as tasksApi from '../api/tasks'
import type { WorkspaceRole } from '../api/workspaces'

vi.mock('../api/sprints')
// The page loads the project's tasks once to derive each sprint's progress bar.
vi.mock('../api/tasks')

beforeEach(() => {
  // Call history does not reset between tests on its own, and one test asserts a mock was never
  // called.
  vi.clearAllMocks()
  vi.mocked(tasksApi.listTasks).mockResolvedValue([])
})

function renderSprintsPage(role: WorkspaceRole) {
  return render(
    <MemoryRouter>
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
        <SprintsPage />
      </ProjectContext.Provider>
    </MemoryRouter>,
  )
}

describe('SprintsPage', () => {
  it('lists sprints with their status and date range', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([
      {
        id: 's1',
        project_id: 'p1',
        name: 'Sprint 1',
        goal: 'Complete authentication',
        start_date: '2026-08-10',
        end_date: '2026-08-23',
        status: 'PLANNED',
        created_at: 'now',
        updated_at: 'now',
      },
    ])

    renderSprintsPage('OWNER')

    expect(await screen.findByText('Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('Complete authentication')).toBeInTheDocument()
    expect(screen.getByText('PLANNED')).toBeInTheDocument()
  })

  it('shows an empty state when there are no sprints', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([])

    renderSprintsPage('OWNER')

    expect(await screen.findByText('No sprints yet.')).toBeInTheDocument()
  })

  it('lets an owner create a sprint', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([])
    vi.mocked(sprintsApi.createSprint).mockResolvedValue({
      id: 's2',
      project_id: 'p1',
      name: 'Sprint 2',
      goal: null,
      start_date: '2026-09-01',
      end_date: '2026-09-14',
      status: 'PLANNED',
      created_at: 'now',
      updated_at: 'now',
    })

    renderSprintsPage('OWNER')

    await screen.findByText('No sprints yet.')
    await userEvent.click(screen.getByRole('button', { name: /new sprint/i }))
    await userEvent.type(screen.getByLabelText('Name'), 'Sprint 2')
    await userEvent.type(screen.getByLabelText('Start date'), '2026-09-01')
    await userEvent.type(screen.getByLabelText('End date'), '2026-09-14')
    await userEvent.click(screen.getByRole('button', { name: /create sprint/i }))

    expect(await screen.findByText('Sprint 2')).toBeInTheDocument()
  })

  it('refuses a mistyped year instead of saving a year-0026 sprint', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([])

    renderSprintsPage('OWNER')

    await screen.findByText('No sprints yet.')
    await userEvent.click(screen.getByRole('button', { name: /new sprint/i }))
    await userEvent.type(screen.getByLabelText('Name'), 'Sep')
    // Set directly: a date input will not accept a year-0026 value through simulated typing.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '0026-09-10' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '0026-10-10' } })
    fireEvent.submit(screen.getByLabelText('Name').closest('form') as HTMLFormElement)

    expect(await screen.findByText(/four-digit year/i)).toBeInTheDocument()
    expect(sprintsApi.createSprint).not.toHaveBeenCalled()
  })

  it('hides the "New sprint" action for members', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([])

    renderSprintsPage('MEMBER')

    await screen.findByText('No sprints yet.')
    expect(screen.queryByRole('button', { name: /new sprint/i })).not.toBeInTheDocument()
  })
})
