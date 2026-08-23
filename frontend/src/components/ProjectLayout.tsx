import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import * as projectsApi from '../api/projects'
import { ProjectContext } from '../context/ProjectContext'
import { useShell } from '../context/ShellContext'
import { useResourceById } from '../hooks/useResourceById'
import { PageHeader } from './PageHeader'
import { Skeleton } from './Skeleton'

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const { setActiveProject } = useShell()

  const {
    value: project,
    isPending,
    isNotFound,
    error,
    setValue: setProject,
  } = useResourceById(
    projectId,
    projectsApi.getProject,
    'Could not load this project. Please try again.',
  )

  // The shell renders the project's nav, and cannot read the project from the URL — the project
  // routes are not nested under the workspace ones. See ShellContext.
  useEffect(() => {
    setActiveProject(project ?? null)
    return () => setActiveProject(null)
  }, [project, setActiveProject])

  const projectContext = useMemo(
    () => (project ? { project, setProject } : undefined),
    [project, setProject],
  )

  if (isNotFound) {
    return <Navigate to="/onboarding" replace />
  }

  if (error) {
    return <div className="error-banner">{error}</div>
  }

  if (isPending || !project || !projectContext) {
    return (
      <div className="stack">
        <Skeleton width="180px" height="24px" />
        <Skeleton width="320px" />
      </div>
    )
  }

  return (
    <div className="project-page">
      <PageHeader
        title={project.name}
        titleAside={<span className="key-chip">{project.key}</span>}
        backTo={`/workspaces/${project.workspace_id}`}
        backLabel={project.workspace_name}
      />

      <ProjectContext.Provider value={projectContext}>
        <Outlet />
      </ProjectContext.Provider>
    </div>
  )
}
