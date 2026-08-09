import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import type { Task } from '../api/tasks'

function priorityBadgeClass(priority: Task['priority']): string {
  if (priority === 'URGENT') return 'badge badge--urgent'
  if (priority === 'HIGH') return 'badge badge--high'
  if (priority === 'LOW') return 'badge badge--low'
  return 'badge'
}

export function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

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
      <div className="task-card__key">{task.key}</div>
      <div className="task-card__title">{task.title}</div>
      <div className="task-card__meta">
        <span className={priorityBadgeClass(task.priority)}>{task.priority}</span>
        <span className="task-card__assignee">{task.assignee?.full_name ?? 'Unassigned'}</span>
      </div>
    </Link>
  )
}
