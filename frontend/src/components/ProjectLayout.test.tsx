import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ProjectLayout } from './ProjectLayout'
import { ShellProvider } from '../context/ShellContext'
import * as projectsApi from '../api/projects'
import type { Project } from '../api/projects'

vi.mock('../api/projects')

const PROJECT: Project = {
  id: 'p1',
  workspace_id: 'w1',
  workspace_name: 'Acme',
  name: 'Payment Platform',
  key: 'PAY',
  description: null,
  role: 'OWNER',
  created_at: 'now',
  updated_at: 'now',
}

// Mirrors the nested project routes in App.tsx.
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<Navigate to="board" replace />} />
          <Route path="overview" element={<p>Overview screen</p>} />
          <Route path="board" element={<p>Board screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(projectsApi.getProject).mockResolvedValue(PROJECT)
})

describe('ProjectLayout', () => {
  it('lands on the board when a project is opened by its bare url', async () => {
    renderAt('/projects/p1')

    expect(await screen.findByText('Board screen')).toBeInTheDocument()
    expect(screen.queryByText('Overview screen')).not.toBeInTheDocument()
  })

  it('still reaches the overview through its own route', async () => {
    renderAt('/projects/p1/overview')

    expect(await screen.findByText('Overview screen')).toBeInTheDocument()
    expect(screen.queryByText('Board screen')).not.toBeInTheDocument()
  })

  it('shows the project header once it has loaded', async () => {
    renderAt('/projects/p1/overview')

    expect(await screen.findByRole('heading', { name: 'Payment Platform' })).toBeInTheDocument()
    expect(screen.getByText('PAY')).toBeInTheDocument()
  })

  // The nav for these routes lives in the app shell, which reads the project from ShellContext.
  it('registers the loaded project with the shell', async () => {
    const setActiveProject = vi.fn()

    render(
      <MemoryRouter initialEntries={['/projects/p1/board']}>
        <ShellProvider value={{ activeProject: null, setActiveProject }}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectLayout />}>
              <Route path="board" element={<p>Board screen</p>} />
            </Route>
          </Routes>
        </ShellProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Board screen')
    expect(setActiveProject).toHaveBeenCalledWith(PROJECT)
  })
})
