import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.api.v1.projects import ProjectMembership, get_project_membership, require_project_owner
from app.db.session import get_db
from app.models.sprint import Sprint, SprintStatus
from app.models.task import Task
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.schemas.sprint import SprintCreate, SprintRead, SprintUpdate

router = APIRouter(prefix="/sprints", tags=["sprints"])
project_sprints_router = APIRouter(prefix="/projects", tags=["sprints"])

SprintMembership = tuple[Sprint, WorkspaceMember]


def get_sprint_membership(
    sprint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintMembership:
    """Resolves a sprint together with the current user's membership in its
    project's workspace (Sprint -> Project -> WorkspaceMember).

    Returns 404 both when the sprint doesn't exist and when the user isn't a
    member of its workspace, so a sprint's existence is never revealed to
    accounts outside its tenant boundary.
    """
    sprint = (
        db.query(Sprint).options(joinedload(Sprint.project)).filter(Sprint.id == sprint_id).first()
    )
    if sprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == sprint.project.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    return sprint, membership


def require_sprint_owner(
    sprint_membership: SprintMembership = Depends(get_sprint_membership),
) -> SprintMembership:
    _sprint, membership = sprint_membership
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners can perform this action",
        )
    return sprint_membership


def build_sprint_read(sprint: Sprint) -> dict:
    return {
        "id": sprint.id,
        "project_id": sprint.project_id,
        "name": sprint.name,
        "goal": sprint.goal,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "status": sprint.status,
        "created_at": sprint.created_at,
        "updated_at": sprint.updated_at,
    }


@project_sprints_router.get("/{project_id}/sprints", response_model=list[SprintRead])
def list_sprints(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    _project_membership: ProjectMembership = Depends(get_project_membership),
) -> list[dict]:
    sprints = (
        db.query(Sprint)
        .filter(Sprint.project_id == project_id)
        .order_by(Sprint.created_at)
        .all()
    )
    return [build_sprint_read(s) for s in sprints]


@project_sprints_router.post(
    "/{project_id}/sprints", response_model=SprintRead, status_code=status.HTTP_201_CREATED
)
def create_sprint(
    project_id: uuid.UUID,
    payload: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _owner_membership: ProjectMembership = Depends(require_project_owner),
) -> dict:
    sprint = Sprint(
        project_id=project_id,
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by=current_user.id,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return build_sprint_read(sprint)


@router.get("/{sprint_id}", response_model=SprintRead)
def get_sprint(sprint_membership: SprintMembership = Depends(get_sprint_membership)) -> dict:
    sprint, _membership = sprint_membership
    return build_sprint_read(sprint)


@router.patch("/{sprint_id}", response_model=SprintRead)
def update_sprint(
    payload: SprintUpdate,
    db: Session = Depends(get_db),
    sprint_membership: SprintMembership = Depends(require_sprint_owner),
) -> dict:
    sprint, _membership = sprint_membership

    if sprint.status == SprintStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Cannot edit a completed sprint"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sprint, field, value)

    if sprint.end_date <= sprint.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be after start_date",
        )

    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return build_sprint_read(sprint)


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint(
    db: Session = Depends(get_db),
    sprint_membership: SprintMembership = Depends(require_sprint_owner),
) -> None:
    sprint, _membership = sprint_membership
    if sprint.status != SprintStatus.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Only a planned sprint can be deleted"
        )

    has_tasks = db.query(Task).filter(Task.sprint_id == sprint.id).first() is not None
    if has_tasks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a sprint that has tasks assigned to it",
        )

    db.delete(sprint)
    db.commit()


@router.post("/{sprint_id}/start", response_model=SprintRead)
def start_sprint(
    db: Session = Depends(get_db),
    sprint_membership: SprintMembership = Depends(require_sprint_owner),
) -> dict:
    sprint, _membership = sprint_membership
    if sprint.status != SprintStatus.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Only a planned sprint can be started"
        )

    active_sprint_exists = (
        db.query(Sprint)
        .filter(Sprint.project_id == sprint.project_id, Sprint.status == SprintStatus.ACTIVE)
        .first()
    )
    if active_sprint_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This project already has an active sprint",
        )

    sprint.status = SprintStatus.ACTIVE
    db.add(sprint)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This project already has an active sprint",
        ) from exc
    db.refresh(sprint)
    return build_sprint_read(sprint)


@router.post("/{sprint_id}/complete", response_model=SprintRead)
def complete_sprint(
    db: Session = Depends(get_db),
    sprint_membership: SprintMembership = Depends(require_sprint_owner),
) -> dict:
    sprint, _membership = sprint_membership
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Only an active sprint can be completed"
        )

    sprint.status = SprintStatus.COMPLETED
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return build_sprint_read(sprint)
