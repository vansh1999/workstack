import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AppLayout } from './AppLayout'
import { AuthProvider } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import * as authApi from '../api/auth'
import * as workspacesApi from '../api/workspaces'
import { ApiError } from '../api/client'
import type { Workspace } from '../api/workspaces'

vi.mock('../api/auth')
vi.mock('../api/workspaces')

const WORKSPACE: Workspace = { id: 'w1', name: 'Acme', role: 'OWNER', created_at: 'now' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let projectMountCount = 0

function OnboardingStub() {
  return <Link to="/workspaces/w1">Open Acme</Link>
}

function WorkspaceStub() {
  const { workspace } = useWorkspace()
  return (
    <div>
      <p>Projects of {workspace.name}</p>
      <Link to="/projects/p1">Open Payment Platform</Link>
    </div>
  )
}

function ProjectStub() {
  useEffect(() => {
    projectMountCount += 1
  }, [])
  return <p>Project screen</p>
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/onboarding" element={<OnboardingStub />} />
            <Route path="/workspaces/:workspaceId" element={<WorkspaceStub />} />
            <Route path="/projects/:projectId" element={<ProjectStub />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  projectMountCount = 0
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue({
    id: 'u1',
    email: 'a@example.com',
    full_name: 'A',
    created_at: 'now',
  })
  vi.mocked(workspacesApi.listMembers).mockResolvedValue([])
})

describe('AppLayout', () => {
  it('opens a workspace on a single click instead of bouncing back to /onboarding', async () => {
    // Held open so we can inspect the render that happens before the workspace has loaded —
    // the render that used to redirect straight back to /onboarding.
    const workspaceRequest = deferred<Workspace>()
    vi.mocked(workspacesApi.getWorkspace).mockReturnValue(workspaceRequest.promise)

    renderApp()

    await userEvent.click(await screen.findByText('Open Acme'))

    expect(await screen.findByText('Loading workspace…')).toBeInTheDocument()
    expect(screen.queryByText('Open Acme')).not.toBeInTheDocument()

    workspaceRequest.resolve(WORKSPACE)

    expect(await screen.findByText('Projects of Acme')).toBeInTheDocument()
    expect(screen.queryByText('Open Acme')).not.toBeInTheDocument()
  })

  it('still redirects to /onboarding when the workspace does not exist', async () => {
    vi.mocked(workspacesApi.getWorkspace).mockRejectedValue(new ApiError(404, 'Not found'))

    renderApp()

    await userEvent.click(await screen.findByText('Open Acme'))

    await waitFor(() => expect(screen.getByText('Open Acme')).toBeInTheDocument())
    expect(screen.queryByText('Projects of Acme')).not.toBeInTheDocument()
  })

  it('surfaces a non-404 failure instead of silently redirecting away', async () => {
    vi.mocked(workspacesApi.getWorkspace).mockRejectedValue(new ApiError(500, 'Server exploded'))

    renderApp()

    await userEvent.click(await screen.findByText('Open Acme'))

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
    expect(screen.queryByText('Open Acme')).not.toBeInTheDocument()
  })

  it('goes back to the workspace list when the brand is clicked', async () => {
    vi.mocked(workspacesApi.getWorkspace).mockResolvedValue(WORKSPACE)

    renderApp()

    await userEvent.click(await screen.findByText('Open Acme'))
    expect(await screen.findByText('Projects of Acme')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Work Stack' }))

    expect(await screen.findByText('Open Acme')).toBeInTheDocument()
    expect(screen.queryByText('Projects of Acme')).not.toBeInTheDocument()
  })

  it('does not remount the route subtree when navigating from a workspace into a project', async () => {
    vi.mocked(workspacesApi.getWorkspace).mockResolvedValue(WORKSPACE)

    renderApp()

    await userEvent.click(await screen.findByText('Open Acme'))
    await userEvent.click(await screen.findByText('Open Payment Platform'))

    expect(await screen.findByText('Project screen')).toBeInTheDocument()
    // Clearing the workspace used to swap the wrapper element type, tearing the project route
    // down and mounting it again — which duplicated its data fetches.
    expect(projectMountCount).toBe(1)
  })
})
