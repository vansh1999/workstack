import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.api.v1.projects import ProjectMembership, get_project_membership
from app.db.session import get_db
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])
project_tasks_router = APIRouter(prefix="/projects", tags=["tasks"])

TaskMembership = tuple[Task, WorkspaceMember]

_TASK_LOAD_OPTIONS = (
    joinedload(Task.project),
    joinedload(Task.sprint),
    joinedload(Task.assignee),
    joinedload(Task.reporter),
)


def get_task_membership(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskMembership:
    """Resolves a task together with the current user's membership in its
    project's workspace (Task -> Project -> WorkspaceMember).

    Returns 404 both when the task doesn't exist and when the user isn't a
    member of its workspace, so a task's existence is never revealed to
    accounts outside its tenant boundary.
    """
    task = db.query(Task).options(*_TASK_LOAD_OPTIONS).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == task.project.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return task, membership


def require_task_owner(
    task_membership: TaskMembership = Depends(get_task_membership),
) -> TaskMembership:
    _task, membership = task_membership
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners can perform this action",
        )
    return task_membership


def _validate_assignee(db: Session, workspace_id: uuid.UUID, assignee_id: uuid.UUID) -> None:
    exists = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == assignee_id,
        )
        .first()
    )
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Assignee must be a member of this workspace",
        )


def _validate_sprint_in_project(db: Session, project_id: uuid.UUID, sprint_id: uuid.UUID) -> None:
    exists = (
        db.query(Sprint).filter(Sprint.id == sprint_id, Sprint.project_id == project_id).first()
    )
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Sprint must belong to the same project",
        )


def _next_task_number(db: Session, project_id: uuid.UUID) -> int:
    # Row-level locking on the UPDATE serializes concurrent task creation for
    # the same project, so two requests can never be handed the same number.
    result = db.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(next_task_number=Project.next_task_number + 1)
        .returning(Project.next_task_number)
    )
    return result.scalar_one() - 1


def build_task_read(task: Task, role: WorkspaceRole) -> dict:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "project_name": task.project.name,
        "workspace_id": task.project.workspace_id,
        "sprint_id": task.sprint_id,
        "sprint_name": task.sprint.name if task.sprint is not None else None,
        "key": f"{task.project.key}-{task.task_number}",
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assignee": task.assignee,
        "reporter": task.reporter,
        "role": role,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


@project_tasks_router.get("/{project_id}/tasks", response_model=list[TaskRead])
def list_tasks(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID | None = None,
    backlog: bool = False,
    db: Session = Depends(get_db),
    project_membership: ProjectMembership = Depends(get_project_membership),
) -> list[dict]:
    _project, membership = project_membership
    query = (
        db.query(Task).options(*_TASK_LOAD_OPTIONS).filter(Task.project_id == project_id)
    )
    if backlog:
        query = query.filter(Task.sprint_id.is_(None))
    elif sprint_id is not None:
        query = query.filter(Task.sprint_id == sprint_id)

    tasks = query.order_by(Task.task_number).all()
    return [build_task_read(t, membership.role) for t in tasks]


@project_tasks_router.post(
    "/{project_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED
)
def create_task(
    project_id: uuid.UUID,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    project_membership: ProjectMembership = Depends(get_project_membership),
) -> dict:
    _project, membership = project_membership

    if payload.assignee_id is not None:
        _validate_assignee(db, _project.workspace_id, payload.assignee_id)

    if payload.sprint_id is not None:
        _validate_sprint_in_project(db, project_id, payload.sprint_id)
        task_status = TaskStatus.TODO
    else:
        task_status = TaskStatus.BACKLOG

    task_number = _next_task_number(db, project_id)

    task = Task(
        project_id=project_id,
        sprint_id=payload.sprint_id,
        task_number=task_number,
        title=payload.title,
        description=payload.description,
        status=task_status,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        reporter_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return build_task_read(task, membership.role)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_membership: TaskMembership = Depends(get_task_membership)) -> dict:
    task, membership = task_membership
    return build_task_read(task, membership.role)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    task_membership: TaskMembership = Depends(get_task_membership),
) -> dict:
    task, membership = task_membership
    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("assignee_id") is not None:
        _validate_assignee(db, task.project.workspace_id, update_data["assignee_id"])

    for field, value in update_data.items():
        setattr(task, field, value)

    # Keep status/sprint consistent: BACKLOG can never carry a sprint, and
    # explicitly clearing the sprint (without also setting a status) implies
    # moving back to the backlog.
    if update_data.get("status") == TaskStatus.BACKLOG:
        task.sprint_id = None
    elif "sprint_id" in update_data and update_data["sprint_id"] is None and "status" not in update_data:
        task.status = TaskStatus.BACKLOG

    if task.status != TaskStatus.BACKLOG and task.sprint_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A sprint must be selected for this status",
        )

    if task.sprint_id is not None:
        _validate_sprint_in_project(db, task.project_id, task.sprint_id)

    db.add(task)
    db.commit()
    db.refresh(task)
    return build_task_read(task, membership.role)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    db: Session = Depends(get_db),
    task_membership: TaskMembership = Depends(require_task_owner),
) -> None:
    task, _membership = task_membership
    db.delete(task)
    db.commit()
