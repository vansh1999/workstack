import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.workspace import WorkspaceRole
from app.schemas.user import UserRead

TaskStatus = Literal["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]
TaskPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    priority: TaskPriority = "MEDIUM"
    assignee_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    workspace_id: uuid.UUID
    sprint_id: uuid.UUID | None
    sprint_name: str | None
    key: str
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee: UserRead | None
    reporter: UserRead
    role: WorkspaceRole
    created_at: datetime
    updated_at: datetime
