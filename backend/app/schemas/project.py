import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.workspace import WorkspaceRole

KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{1,9}$")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    key: str = Field(min_length=2, max_length=10)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not KEY_PATTERN.match(normalized):
            raise ValueError(
                "Key must be 2-10 characters, start with a letter, and contain only "
                "uppercase letters and numbers"
            )
        return normalized


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    workspace_name: str
    name: str
    key: str
    description: str | None
    role: WorkspaceRole
    created_at: datetime
    updated_at: datetime
