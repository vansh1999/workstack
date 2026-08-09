import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.api.v1.projects import build_project_read
from app.core.config import settings
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.workspace import (
    InvitationCreate,
    InvitationCreateResponse,
    WorkspaceCreate,
    WorkspaceMemberRead,
    WorkspaceRead,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def get_membership(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMember:
    """Resolves the current user's membership in a workspace.

    Returns 404 (not 403) when the user isn't a member, so a workspace's
    existence is never revealed to accounts outside its tenant boundary.
    """
    membership = (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.workspace))
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return membership


def require_owner(membership: WorkspaceMember = Depends(get_membership)) -> WorkspaceMember:
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners can perform this action",
        )
    return membership


def _workspace_read_dict(workspace: Workspace, role: WorkspaceRole) -> dict:
    return {
        "id": workspace.id,
        "name": workspace.name,
        "role": role,
        "created_at": workspace.created_at,
    }


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    memberships = (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.workspace))
        .filter(WorkspaceMember.user_id == current_user.id)
        .order_by(WorkspaceMember.created_at)
        .all()
    )
    return [_workspace_read_dict(m.workspace, m.role) for m in memberships]


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    workspace = Workspace(name=payload.name, created_by=current_user.id)
    db.add(workspace)
    db.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id, user_id=current_user.id, role=WorkspaceRole.OWNER
    )
    db.add(membership)
    db.commit()
    db.refresh(workspace)

    return _workspace_read_dict(workspace, WorkspaceRole.OWNER)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(membership: WorkspaceMember = Depends(get_membership)) -> dict:
    return _workspace_read_dict(membership.workspace, membership.role)


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberRead])
def list_members(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    _membership: WorkspaceMember = Depends(get_membership),
) -> list[WorkspaceMember]:
    return (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at)
        .all()
    )


@router.post(
    "/{workspace_id}/invitations",
    response_model=InvitationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    workspace_id: uuid.UUID,
    payload: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _owner_membership: WorkspaceMember = Depends(require_owner),
) -> dict:
    invitation = WorkspaceInvitation(
        workspace_id=workspace_id,
        email=payload.email,
        token=secrets.token_urlsafe(32),
        invited_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_EXPIRE_HOURS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return {
        "id": invitation.id,
        "workspace_id": invitation.workspace_id,
        "email": invitation.email,
        "expires_at": invitation.expires_at,
        "created_at": invitation.created_at,
        "invite_url": f"{settings.FRONTEND_BASE_URL}/invite/{invitation.token}",
    }


@router.get("/{workspace_id}/projects", response_model=list[ProjectRead])
def list_projects(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership: WorkspaceMember = Depends(get_membership),
) -> list[dict]:
    projects = (
        db.query(Project)
        .filter(Project.workspace_id == workspace_id)
        .order_by(Project.created_at)
        .all()
    )
    return [build_project_read(p, membership.role, membership.workspace.name) for p in projects]


@router.post(
    "/{workspace_id}/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
def create_project(
    workspace_id: uuid.UUID,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    owner_membership: WorkspaceMember = Depends(require_owner),
) -> dict:
    existing = db.query(Project).filter(Project.key == payload.key).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Project key is already in use"
        )

    project = Project(
        workspace_id=workspace_id,
        name=payload.name,
        key=payload.key,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return build_project_read(project, owner_membership.role, owner_membership.workspace.name)
