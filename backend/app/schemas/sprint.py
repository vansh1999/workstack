import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SprintStatus = Literal["PLANNED", "ACTIVE", "COMPLETED"]


class SprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    goal: str | None = Field(default=None, max_length=2000)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def check_date_order(self) -> "SprintCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def check_date_order(self) -> "SprintUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date <= self.start_date
        ):
            raise ValueError("end_date must be after start_date")
        return self


class SprintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    goal: str | None
    start_date: date
    end_date: date
    status: SprintStatus
    created_at: datetime
    updated_at: datetime
