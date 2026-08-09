import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import * as workspacesApi from '../api/workspaces'
import type { Workspace } from '../api/workspaces'

export function HomeRedirect() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)

  useEffect(() => {
    workspacesApi.listWorkspaces().then(setWorkspaces)
  }, [])

  if (workspaces === null) {
    return <p className="loading-state">Loading…</p>
  }

  if (workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  return <Navigate to={`/workspaces/${workspaces[0].id}`} replace />
}
