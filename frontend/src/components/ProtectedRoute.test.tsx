import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider } from '../context/AuthContext'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

function renderProtected(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new Error('unauthenticated'))

    renderProtected(['/'])

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument())
  })

  it('renders protected content when authenticated', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValue({
      id: '1',
      email: 'a@example.com',
      full_name: 'A',
      created_at: 'now',
    })

    renderProtected(['/'])

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })
})
