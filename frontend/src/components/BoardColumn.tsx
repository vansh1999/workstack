import { useDroppable } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../api/tasks'
import { TaskCard } from './TaskCard'

interface BoardColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
}

export function BoardColumn({ id, title, tasks }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="board__column">
      <div className="board__column-header">
        <span>{title}</span>
        <span className="board__column-count">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`board__column-body${isOver ? ' board__column-body--over' : ''}`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
