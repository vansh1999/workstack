import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import type { Task } from '../api/tasks'
import { PriorityBadge } from './Badge'
import { Avatar } from './Avatar'

/** Card contents, shared by the board card and the drag overlay. */
function TaskCardBody({ task }: { task: Task }) {
  return (
    <>
      <div className="task-card__key">{task.key}</div>
      <div className="task-card__title">{task.title}</div>
      <div className="task-card__meta">
        <PriorityBadge priority={task.priority} />
        {task.assignee ? (
          <span title={task.assignee.full_name}>
            <Avatar name={task.assignee.full_name} size="sm" />
          </span>
        ) : (
          <span className="task-card__key">Unassigned</span>
        )}
      </div>
    </>
  )
}

export function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  // The overlay follows the cursor, so the card itself only needs to dim in place.
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <Link
      ref={setNodeRef}
      style={style}
      to={`/tasks/${task.id}`}
      className={`task-card${isDragging ? ' task-card--dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <TaskCardBody task={task} />
    </Link>
  )
}

/** What follows the cursor mid-drag: the same card, lifted off the board. */
export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="task-card task-card--overlay">
      <TaskCardBody task={task} />
    </div>
  )
}
