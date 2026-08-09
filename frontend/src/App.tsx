import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RedirectIfAuthenticated } from './components/RedirectIfAuthenticated'
import { ProjectLayout } from './components/ProjectLayout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectOverviewPage } from './pages/ProjectOverviewPage'
import { ProjectBoardPage } from './pages/ProjectBoardPage'
import { SprintsPage } from './pages/SprintsPage'
import { SprintDetailPage } from './pages/SprintDetailPage'
import { MembersPage } from './pages/MembersPage'
import { InvitePage } from './pages/InvitePage'
import { TaskPage } from './pages/TaskPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route element={<RedirectIfAuthenticated />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/workspaces/:workspaceId" element={<ProjectsPage />} />
              <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
              <Route path="/tasks/:taskId" element={<TaskPage />} />
              <Route path="/projects/:projectId" element={<ProjectLayout />}>
                <Route index element={<ProjectOverviewPage />} />
                <Route path="sprints" element={<SprintsPage />} />
                <Route path="sprints/:sprintId" element={<SprintDetailPage />} />
                <Route path="board" element={<ProjectBoardPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
