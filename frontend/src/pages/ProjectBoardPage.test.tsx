import { render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ProjectBoardPage } from './ProjectBoardPage'
import { ProjectContext } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import * as tasksApi from '../api/tasks'
import * as workspacesApi from '../api/workspaces'
import type { Task } from '../api/tasks'
import type { WorkspaceRole } from '../api/workspaces'

vi.mock('../api/sprints')
vi.mock('../api/tasks')
vi.mock('../api/workspaces')

let capturedOnDragEnd: ((event: unknown) => void) | null = null

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragEnd: (event: unknown) => void
  }) => {
    capturedOnDragEnd = onDragEnd
    return children
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}))

const SPRINT = {
  id: 's1',
  project_id: 'p1',
  name: 'Sprint 1',
  goal: null,
  start_date: '2026-08-10',
  end_date: '2026-08-23',
  status: 'ACTIVE' as const,
  created_at: 'now',
  updated_at: 'now',
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    project_id: 'p1',
    project_name: 'Acme Project',
    workspace_id: 'w1',
    sprint_id: null,
    sprint_name: null,
    key: 'PAY-1',
    title: 'Fix login bug',
    description: null,
    status: 'BACKLOG',
    priority: 'MEDIUM',
    assignee: null,
    reporter: { id: 'u1', email: 'owner@example.com', full_name: 'Owner', created_at: 'now' },
    role: 'OWNER',
    created_at: 'now',
    updated_at: 'now',
    ...overrides,
  }
}

function renderBoard(role: WorkspaceRole) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1/board']}>
      <ProjectContext.Provider
        value={{
          project: {
            id: 'p1',
            workspace_id: 'w1',
            workspace_name: 'Acme',
            name: 'Acme Project',
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
          <Route path="/projects/:projectId/board" element={<ProjectBoardPage />} />
        </Routes>
      </ProjectContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  capturedOnDragEnd = null
  vi.mocked(workspacesApi.listMembers).mockResolvedValue([])
})

describe('ProjectBoardPage', () => {
  it('shows an empty state explaining a sprint must be created first', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([])

    renderBoard('OWNER')

    expect(await screen.findByText(/no sprints yet/i)).toBeInTheDocument()
  })

  it('renders tasks in their correct columns', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([SPRINT])
    vi.mocked(tasksApi.listTasks).mockImplementation((_projectId, params) => {
      if (params?.backlog) {
        return Promise.resolve([makeTask({ id: 'backlog-1', title: 'Backlog task' })])
      }
      return Promise.resolve([
        makeTask({
          id: 'todo-1',
          title: 'Todo task',
          status: 'TODO',
          sprint_id: 's1',
          sprint_name: 'Sprint 1',
        }),
      ])
    })

    renderBoard('OWNER')

    expect(await screen.findByText('Backlog task')).toBeInTheDocument()
    expect(await screen.findByText('Todo task')).toBeInTheDocument()
  })

  // listSprints returns them oldest-first; the board used to open on that first entry.
  it('opens on the most recent sprint when none is active', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([
      { ...SPRINT, id: 's1', name: 'Sprint 1', start_date: '2026-08-10', status: 'COMPLETED' },
      { ...SPRINT, id: 's2', name: 'Sprint 2', start_date: '2026-08-24', status: 'PLANNED' },
    ])
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])

    renderBoard('OWNER')

    const picker = (await screen.findByLabelText('Sprint')) as HTMLSelectElement
    expect(picker.value).toBe('s2')
    // And the newest is offered first, so the default is at the top of the list.
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      'Sprint 2',
      'Sprint 1',
    ])
    expect(tasksApi.listTasks).toHaveBeenCalledWith('p1', { sprintId: 's2' })
  })

  it('still opens on the active sprint even when a later one is planned', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([
      { ...SPRINT, id: 's1', name: 'Sprint 1', start_date: '2026-08-10', status: 'ACTIVE' },
      { ...SPRINT, id: 's2', name: 'Sprint 2', start_date: '2026-08-24', status: 'PLANNED' },
    ])
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])

    renderBoard('OWNER')

    expect(((await screen.findByLabelText('Sprint')) as HTMLSelectElement).value).toBe('s1')
  })

  it('creates a task and shows it on the board', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([SPRINT])
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    vi.mocked(tasksApi.createTask).mockResolvedValue(
      makeTask({
        id: 'new-1',
        title: 'Retry webhook delivery',
        status: 'TODO',
        sprint_id: 's1',
        sprint_name: 'Sprint 1',
      }),
    )

    renderBoard('OWNER')

    // "New task" opens the dialog; "Create task" inside it submits.
    await userEvent.click(await screen.findByRole('button', { name: /^new task$/i }))
    await userEvent.type(screen.getByLabelText('Title'), 'Retry webhook delivery')
    await userEvent.click(screen.getByRole('button', { name: /^create task$/i }))

    expect(await screen.findByText('Retry webhook delivery')).toBeInTheDocument()
  })

  it('moves a task to a new column on drag end and calls the API', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([SPRINT])
    vi.mocked(tasksApi.listTasks).mockImplementation((_projectId, params) => {
      if (params?.backlog) return Promise.resolve([])
      return Promise.resolve([
        makeTask({ id: 'todo-1', title: 'Todo task', status: 'TODO', sprint_id: 's1' }),
      ])
    })
    vi.mocked(tasksApi.updateTask).mockResolvedValue(
      makeTask({ id: 'todo-1', title: 'Todo task', status: 'IN_PROGRESS', sprint_id: 's1' }),
    )

    renderBoard('OWNER')
    await screen.findByText('Todo task')

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: 'todo-1' }, over: { id: 'IN_PROGRESS' } })
    })

    expect(tasksApi.updateTask).toHaveBeenCalledWith('todo-1', {
      status: 'IN_PROGRESS',
      sprint_id: 's1',
    })
  })

  it('reverts the move and shows an error if the API call fails', async () => {
    vi.mocked(sprintsApi.listSprints).mockResolvedValue([SPRINT])
    vi.mocked(tasksApi.listTasks).mockImplementation((_projectId, params) => {
      if (params?.backlog) return Promise.resolve([])
      return Promise.resolve([
        makeTask({ id: 'todo-1', title: 'Todo task', status: 'TODO', sprint_id: 's1' }),
      ])
    })
    const { ApiError } = await import('../api/client')
    vi.mocked(tasksApi.updateTask).mockRejectedValue(new ApiError(422, 'Invalid move'))

    renderBoard('OWNER')
    await screen.findByText('Todo task')

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: 'todo-1' }, over: { id: 'DONE' } })
    })

    expect(await screen.findByText('Invalid move')).toBeInTheDocument()
  })
})
