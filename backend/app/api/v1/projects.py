import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.schemas.project import ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

ProjectMembership = tuple[Project, WorkspaceMember]


def get_project_membership(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMembership:
    """Resolves a project together with the current user's membership in its workspace.

    Returns 404 both when the project doesn't exist and when the user isn't a
    member of its workspace, so a project's existence is never revealed to
    accounts outside its tenant boundary.
    """
    project = (
        db.query(Project)
        .options(joinedload(Project.workspace))
        .filter(Project.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == project.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return project, membership


def require_project_owner(
    project_membership: ProjectMembership = Depends(get_project_membership),
) -> ProjectMembership:
    _project, membership = project_membership
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners can perform this action",
        )
    return project_membership


def build_project_read(project: Project, role: WorkspaceRole, workspace_name: str) -> dict:
    return {
        "id": project.id,
        "workspace_id": project.workspace_id,
        "workspace_name": workspace_name,
        "name": project.name,
        "key": project.key,
        "description": project.description,
        "role": role,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_membership: ProjectMembership = Depends(get_project_membership)) -> dict:
    project, membership = project_membership
    return build_project_read(project, membership.role, project.workspace.name)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    project_membership: ProjectMembership = Depends(require_project_owner),
) -> dict:
    project, membership = project_membership
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    db.add(project)
    db.commit()
    db.refresh(project)
    return build_project_read(project, membership.role, project.workspace.name)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    db: Session = Depends(get_db),
    project_membership: ProjectMembership = Depends(require_project_owner),
) -> None:
    project, _membership = project_membership
    db.delete(project)
    db.commit()
