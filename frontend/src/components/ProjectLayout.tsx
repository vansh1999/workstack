import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import * as projectsApi from '../api/projects'
import type { Project } from '../api/projects'
import { ApiError } from '../api/client'
import { ProjectContext } from '../context/ProjectContext'

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setIsLoading(true)
    setNotFound(false)
    projectsApi
      .getProject(projectId)
      .then(setProject)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
      })
      .finally(() => setIsLoading(false))
  }, [projectId])

  if (isLoading) {
    return <p className="loading-state">Loading project…</p>
  }

  if (notFound || !project) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="project-page">
      <Link className="project-page__back" to={`/workspaces/${project.workspace_id}`}>
        ← {project.workspace_name}
      </Link>

      <h1 className="dashboard__title">{project.name}</h1>

      <div className="tabs">
        <NavLink
          to={`/projects/${project.id}`}
          end
          className={({ isActive }) => `tabs__item${isActive ? ' tabs__item--active' : ''}`}
        >
          Overview
        </NavLink>
        <NavLink
          to={`/projects/${project.id}/sprints`}
          className={({ isActive }) => `tabs__item${isActive ? ' tabs__item--active' : ''}`}
        >
          Sprints
        </NavLink>
        <NavLink
          to={`/projects/${project.id}/board`}
          className={({ isActive }) => `tabs__item${isActive ? ' tabs__item--active' : ''}`}
        >
          Board
        </NavLink>
      </div>

      <ProjectContext.Provider value={{ project, setProject }}>
        <Outlet />
      </ProjectContext.Provider>
    </div>
  )
}
