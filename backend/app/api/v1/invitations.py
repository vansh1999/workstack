from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import WorkspaceInvitation, WorkspaceMember, WorkspaceRole
from app.schemas.workspace import InvitationAcceptResponse, InvitationPublicRead, InvitationStatus

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _get_invitation_or_404(token: str, db: Session) -> WorkspaceInvitation:
    invitation = (
        db.query(WorkspaceInvitation)
        .options(joinedload(WorkspaceInvitation.workspace))
        .filter(WorkspaceInvitation.token == token)
        .first()
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    return invitation


def _invitation_status(invitation: WorkspaceInvitation) -> InvitationStatus:
    if invitation.accepted_at is not None:
        return "accepted"
    if invitation.expires_at < datetime.now(timezone.utc):
        return "expired"
    return "pending"


@router.get("/{token}", response_model=InvitationPublicRead)
def get_invitation(
    token: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> dict:
    invitation = _get_invitation_or_404(token, db)
    return {
        "workspace_name": invitation.workspace.name,
        "email": invitation.email,
        "status": _invitation_status(invitation),
    }


@router.post("/{token}/accept", response_model=InvitationAcceptResponse)
def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    invitation = _get_invitation_or_404(token, db)

    if invitation.accepted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Invitation has already been accepted"
        )

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")

    if invitation.email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different email address",
        )

    existing_membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == invitation.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
        .first()
    )
    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    membership = WorkspaceMember(
        workspace_id=invitation.workspace_id,
        user_id=current_user.id,
        role=WorkspaceRole.MEMBER,
    )
    invitation.accepted_at = datetime.now(timezone.utc)
    db.add(membership)
    db.add(invitation)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        ) from exc

    db.refresh(invitation)

    return {
        "workspace": {
            "id": invitation.workspace.id,
            "name": invitation.workspace.name,
            "role": WorkspaceRole.MEMBER,
            "created_at": invitation.workspace.created_at,
        }
    }
