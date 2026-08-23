import { useDroppable } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../api/tasks'
import { TaskCard } from './TaskCard'
import { IconPlus } from './icons'

export type ColumnTone = 'neutral' | 'blue' | 'green'

interface BoardColumnProps {
  id: TaskStatus
  title: string
  tone: ColumnTone
  tasks: Task[]
  onAddTask?: (status: TaskStatus) => void
}

export function BoardColumn({ id, title, tone, tasks, onAddTask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section className="board__column" aria-label={`${title} (${tasks.length})`}>
      <header className="board__column-header">
        <span className="board__column-title">
          <span className={`board__column-dot board__column-dot--${tone}`} aria-hidden="true" />
          {title}
        </span>
        <span className="board__column-count">{tasks.length}</span>
        {onAddTask && (
          <span className="board__column-actions">
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => onAddTask(id)}
              aria-label={`Add task to ${title}`}
              title={`Add task to ${title}`}
            >
              <IconPlus size={15} />
            </button>
          </span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`board__column-body${isOver ? ' board__column-body--over' : ''}`}
      >
        {tasks.length === 0 ? (
          <p className="board__column-placeholder">Drop tasks here</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </section>
  )
}
