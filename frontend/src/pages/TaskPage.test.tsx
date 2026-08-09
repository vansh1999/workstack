import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { TaskPage } from './TaskPage'
import * as tasksApi from '../api/tasks'
import * as sprintsApi from '../api/sprints'
import * as workspacesApi from '../api/workspaces'
import type { Task } from '../api/tasks'

vi.mock('../api/tasks')
vi.mock('../api/sprints')
vi.mock('../api/workspaces')

const BASE_TASK: Task = {
  id: 't1',
  project_id: 'p1',
  project_name: 'Acme Project',
  workspace_id: 'w1',
  sprint_id: 's1',
  sprint_name: 'Sprint 1',
  key: 'PAY-12',
  title: 'Implement payment retry',
  description: 'Retry failed payments automatically',
  status: 'TODO',
  priority: 'HIGH',
  assignee: { id: 'u2', email: 'nakul@example.com', full_name: 'Nakul', created_at: 'now' },
  reporter: { id: 'u1', email: 'owner@example.com', full_name: 'Owner', created_at: 'now' },
  role: 'OWNER',
  created_at: '2026-08-09T00:00:00Z',
  updated_at: '2026-08-09T00:00:00Z',
}

function renderTaskPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks/t1']}>
      <Routes>
        <Route path="/tasks/:taskId" element={<TaskPage />} />
        <Route path="/projects/:projectId/board" element={<div>Board Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(sprintsApi.listSprints).mockResolvedValue([])
  vi.mocked(workspacesApi.listMembers).mockResolvedValue([])
})

describe('TaskPage', () => {
  it('shows the task key, title, description, and metadata', async () => {
    vi.mocked(tasksApi.getTask).mockResolvedValue(BASE_TASK)

    renderTaskPage()

    expect(await screen.findByText('PAY-12')).toBeInTheDocument()
    expect(screen.getByText('Implement payment retry')).toBeInTheDocument()
    expect(screen.getByText('Retry failed payments automatically')).toBeInTheDocument()
    expect(screen.getByText('TODO')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('Nakul')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Sprint 1')).toBeInTheDocument()
  })

  it('shows Delete for owners and hides it for members', async () => {
    vi.mocked(tasksApi.getTask).mockResolvedValue({ ...BASE_TASK, role: 'MEMBER' })

    renderTaskPage()

    await screen.findByText('PAY-12')
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('lets an owner edit the task and reflects the change', async () => {
    vi.mocked(tasksApi.getTask).mockResolvedValue(BASE_TASK)
    vi.mocked(tasksApi.updateTask).mockResolvedValue({ ...BASE_TASK, title: 'Retry payments v2' })

    renderTaskPage()

    await screen.findByText('PAY-12')
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))

    const titleInput = screen.getByLabelText('Title')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Retry payments v2')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Retry payments v2')).toBeInTheDocument()
  })

  it('deletes the task as owner and navigates to the board', async () => {
    vi.mocked(tasksApi.getTask).mockResolvedValue(BASE_TASK)
    vi.mocked(tasksApi.deleteTask).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderTaskPage()

    await screen.findByText('PAY-12')
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(await screen.findByText('Board Page')).toBeInTheDocument()
    expect(tasksApi.deleteTask).toHaveBeenCalledWith('t1')
  })
})
