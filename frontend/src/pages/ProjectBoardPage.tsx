import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DragEndEvent } from '@dnd-kit/core'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as tasksApi from '../api/tasks'
import type { Task, TaskStatus } from '../api/tasks'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceMember } from '../api/workspaces'
import { ApiError } from '../api/client'
import { BoardColumn } from '../components/BoardColumn'
import { TaskFormModal } from '../components/TaskFormModal'

// kanban board builds here -> ###

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'BACKLOG', title: 'Backlog' },
  { id: 'TODO', title: 'To do' },
  { id: 'IN_PROGRESS', title: 'In progress' },
  { id: 'DONE', title: 'Done' },
]

export function ProjectBoardPage() {
  const { project } = useProject()

  const [sprints, setSprints] = useState<Sprint[] | null>(null)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    sprintsApi.listSprints(project.id).then((result) => {
      setSprints(result)
      const active = result.find((s) => s.status === 'ACTIVE')
      setSelectedSprintId(active?.id ?? result[0]?.id ?? null)
    })
    workspacesApi.listMembers(project.workspace_id).then(setMembers)
  }, [project.id, project.workspace_id])

  const refreshBoard = useCallback(() => {
    setIsLoadingTasks(true)
    Promise.all([
      tasksApi.listTasks(project.id, { backlog: true }),
      selectedSprintId
        ? tasksApi.listTasks(project.id, { sprintId: selectedSprintId })
        : Promise.resolve([]),
    ])
      .then(([backlogTasks, sprintTasks]) => setTasks([...backlogTasks, ...sprintTasks]))
      .finally(() => setIsLoadingTasks(false))
  }, [project.id, selectedSprintId])

  useEffect(() => {
    if (sprints === null || sprints.length === 0) return
    refreshBoard()
  }, [sprints, refreshBoard])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const taskId = String(active.id)
    const targetStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === targetStatus) return

    if (targetStatus !== 'BACKLOG' && !selectedSprintId) return

    const patch =
      targetStatus === 'BACKLOG'
        ? { status: targetStatus, sprint_id: null }
        : { status: targetStatus, sprint_id: selectedSprintId }

    const previousTasks = tasks
    setBoardError(null)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: patch.status, sprint_id: patch.sprint_id } : t,
      ),
    )

    tasksApi
      .updateTask(taskId, patch)
      .then((updated) => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
      })
      .catch((err) => {
        setTasks(previousTasks)
        setBoardError(
          err instanceof ApiError ? err.message : 'Could not move task. Please try again.',
        )
      })
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [...prev, task])
    setIsCreateOpen(false)
  }

  if (sprints === null) {
    return <p className="loading-state">Loading board…</p>
  }

  if (sprints.length === 0) {
    return (
      <p className="loading-state">
        No sprints yet. Create a sprint on the{' '}
        <Link to={`/projects/${project.id}/sprints`}>Sprints</Link> tab before using the board.
      </p>
    )
  }

  return (
    <div className="board-page">
      <div className="board__toolbar">
        <div className="form-field">
          <label htmlFor="board-sprint-select">Sprint</label>
          <select
            id="board-sprint-select"
            value={selectedSprintId ?? ''}
            onChange={(e) => setSelectedSprintId(e.target.value)}
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={() => setIsCreateOpen(true)}>
          + Create task
        </button>
      </div>

      {boardError && <div className="error-banner">{boardError}</div>}

      {isLoadingTasks ? (
        <p className="loading-state">Loading tasks…</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="board">
            {COLUMNS.map((column) => (
              <BoardColumn
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={tasks.filter((t) =>
                  column.id === 'BACKLOG'
                    ? t.sprint_id === null
                    : t.sprint_id === selectedSprintId && t.status === column.id,
                )}
              />
            ))}
          </div>
        </DndContext>
      )}

      {isCreateOpen && (
        <TaskFormModal
          mode="create"
          projectId={project.id}
          members={members}
          sprints={sprints}
          defaultSprintId={selectedSprintId}
          onClose={() => setIsCreateOpen(false)}
          onSaved={handleTaskCreated}
        />
      )}
    </div>
  )
}
