import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.workspace import WorkspaceRole
from app.schemas.user import UserRead


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: WorkspaceRole
    created_at: datetime


class WorkspaceMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: WorkspaceRole
    created_at: datetime
    user: UserRead


class InvitationCreate(BaseModel):
    email: EmailStr


class InvitationCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    expires_at: datetime
    created_at: datetime
    invite_url: str


InvitationStatus = Literal["pending", "expired", "accepted"]


class InvitationPublicRead(BaseModel):
    workspace_name: str
    email: str
    status: InvitationStatus


class InvitationAcceptResponse(BaseModel):
    workspace: WorkspaceRead
