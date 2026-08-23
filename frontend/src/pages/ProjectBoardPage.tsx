import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useProject } from '../context/ProjectContext'
import * as sprintsApi from '../api/sprints'
import type { Sprint } from '../api/sprints'
import * as tasksApi from '../api/tasks'
import type { Task, TaskStatus } from '../api/tasks'
import * as workspacesApi from '../api/workspaces'
import type { WorkspaceMember } from '../api/workspaces'
import { ApiError } from '../api/client'
import { BoardColumn } from '../components/BoardColumn'
import type { ColumnTone } from '../components/BoardColumn'
import { TaskCardOverlay } from '../components/TaskCard'
import { TaskFormModal } from '../components/TaskFormModal'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { IconAlert, IconPlus, IconSprint } from '../components/icons'
import { formatShortDate, describeSprintTiming } from '../lib/dates'
import { byMostRecent, pickDefaultSprint } from '../lib/sprints'

const COLUMNS: { id: TaskStatus; title: string; tone: ColumnTone }[] = [
  { id: 'BACKLOG', title: 'Backlog', tone: 'neutral' },
  { id: 'TODO', title: 'To do', tone: 'neutral' },
  { id: 'IN_PROGRESS', title: 'In progress', tone: 'blue' },
  { id: 'DONE', title: 'Done', tone: 'green' },
]

export function ProjectBoardPage() {
  const { project } = useProject()

  const [sprints, setSprints] = useState<Sprint[] | null>(null)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    sprintsApi.listSprints(project.id).then((result) => {
      setSprints(result)
      setSelectedSprintId(pickDefaultSprint(result)?.id ?? null)
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

  const selectedSprint = sprints?.find((sprint) => sprint.id === selectedSprintId) ?? null

  // Newest first, so the default selection sits at the top of the picker rather than the bottom.
  const orderedSprints = useMemo(() => [...(sprints ?? [])].sort(byMostRecent), [sprints])

  const tasksByColumn = useMemo(() => {
    const grouped = {} as Record<TaskStatus, Task[]>
    for (const column of COLUMNS) {
      grouped[column.id] = tasks.filter((task) =>
        column.id === 'BACKLOG'
          ? task.sprint_id === null
          : task.sprint_id === selectedSprintId && task.status === column.id,
      )
    }
    return grouped
  }, [tasks, selectedSprintId])

  const sprintTaskCount =
    tasksByColumn.TODO.length + tasksByColumn.IN_PROGRESS.length + tasksByColumn.DONE.length
  const sprintProgress =
    sprintTaskCount > 0 ? Math.round((tasksByColumn.DONE.length / sprintTaskCount) * 100) : 0

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null)

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

  function openCreate(status: TaskStatus | null) {
    setCreateStatus(status)
    setIsCreateOpen(true)
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [...prev, task])
    setIsCreateOpen(false)
  }

  if (sprints === null) {
    return (
      <div className="stack">
        <Skeleton width="240px" height="36px" />
        <Skeleton height="180px" />
      </div>
    )
  }

  if (sprints.length === 0) {
    return (
      <EmptyState
        icon={<IconSprint size={20} />}
        title="No sprints yet."
        body={
          <>
            The board schedules work into a sprint. Create one on the{' '}
            <Link to={`/projects/${project.id}/sprints`}>Sprints</Link> tab to get started.
          </>
        }
      />
    )
  }

  const activeTask = activeTaskId ? (tasks.find((t) => t.id === activeTaskId) ?? null) : null

  return (
    <div className="board-page">
      <div className="board__toolbar">
        <div className="board__toolbar-left">
          <div className="form-field">
            <label htmlFor="board-sprint-select">Sprint</label>
            <select
              id="board-sprint-select"
              value={selectedSprintId ?? ''}
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              {orderedSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSprint && (
            <div className="board__sprint-meta">
              <span className="board__sprint-dates">
                {formatShortDate(selectedSprint.start_date)} →{' '}
                {formatShortDate(selectedSprint.end_date)} · {describeSprintTiming(selectedSprint)}
              </span>
              <div className="progress-block">
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={sprintProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Sprint progress"
                >
                  <div className="progress__fill" style={{ width: `${sprintProgress}%` }} />
                </div>
                <div className="progress-block__labels">
                  <span>
                    {tasksByColumn.DONE.length} of {sprintTaskCount} done
                  </span>
                  <span>{sprintProgress}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="btn" onClick={() => openCreate(null)}>
          <IconPlus size={15} />
          New task
        </button>
      </div>

      {boardError && (
        <div className="error-banner">
          <IconAlert size={15} />
          <span>{boardError}</span>
        </div>
      )}

      {isLoadingTasks ? (
        <p className="loading-state">Loading tasks…</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {COLUMNS.map((column) => (
              <BoardColumn
                key={column.id}
                id={column.id}
                title={column.title}
                tone={column.tone}
                tasks={tasksByColumn[column.id]}
                onAddTask={openCreate}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && <TaskCardOverlay task={activeTask} />}
          </DragOverlay>
        </DndContext>
      )}

      {isCreateOpen && (
        <TaskFormModal
          mode="create"
          projectId={project.id}
          members={members}
          sprints={orderedSprints}
          defaultSprintId={createStatus === 'BACKLOG' ? null : selectedSprintId}
          defaultStatus={createStatus ?? undefined}
          onClose={() => setIsCreateOpen(false)}
          onSaved={handleTaskCreated}
        />
      )}
    </div>
  )
}
