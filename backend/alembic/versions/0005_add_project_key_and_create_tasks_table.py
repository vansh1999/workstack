"""add project key/next_task_number and create tasks table

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("key", sa.String(length=10), nullable=True))
    op.add_column(
        "projects",
        sa.Column("next_task_number", sa.Integer(), nullable=False, server_default="1"),
    )

    # Backfill a key for any projects created before this column existed, so
    # the NOT NULL + UNIQUE constraints below can be applied safely.
    connection = op.get_bind()
    existing_projects = connection.execute(sa.text("SELECT id, name FROM projects")).fetchall()
    used_keys: set[str] = set()
    for project_id, name in existing_projects:
        base = "".join(ch for ch in name.upper() if ch.isalnum())[:3] or "PRJ"
        candidate = base
        suffix = 1
        while candidate in used_keys:
            suffix += 1
            candidate = f"{base}{suffix}"
        used_keys.add(candidate)
        connection.execute(
            sa.text("UPDATE projects SET key = :key WHERE id = :id"),
            {"key": candidate, "id": project_id},
        )

    op.alter_column("projects", "key", nullable=False)
    op.create_unique_constraint("uq_projects_key", "projects", ["key"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sprint_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sprints.id"),
            nullable=True,
        ),
        sa.Column("task_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="BACKLOG"),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="MEDIUM"),
        sa.Column(
            "assignee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')", name="ck_tasks_status"
        ),
        sa.CheckConstraint(
            "priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')", name="ck_tasks_priority"
        ),
        sa.UniqueConstraint("project_id", "task_number", name="uq_tasks_project_task_number"),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_sprint_id", "tasks", ["sprint_id"])


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_constraint("uq_projects_key", "projects", type_="unique")
    op.drop_column("projects", "next_task_number")
    op.drop_column("projects", "key")
