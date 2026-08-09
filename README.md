# Work Stack

A minimal, Notion-style Scrum workspace for engineering teams.

This repository currently implements:

- **Phase 1 — Authentication**: registration, login, logout, and an authenticated profile endpoint.
- **Phase 2 — Workspaces**: workspace creation, membership, roles (OWNER/MEMBER), and email-based invitations — the multi-tenant boundary for the app.
- **Phase 3 — Projects**: each workspace can contain multiple projects; owners manage them, members can view.
- **Phase 4 — Sprints**: each project can have multiple sprints with a PLANNED → ACTIVE → COMPLETED lifecycle; owners manage them, members can view.
- **Phase 5 — Tasks + Kanban board**: tasks with human-readable keys (`PAY-12`), backlog/sprint placement, and a drag-and-drop board.

## Architecture

```
React (Vite)  →  FastAPI  →  PostgreSQL
```

- `frontend/` — React + TypeScript, built with Vite.
- `backend/` — FastAPI application with SQLAlchemy + Alembic.
- `docker-compose.yml` — runs PostgreSQL locally (dev + test databases).

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL)

## Local development setup

### 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d
```

This starts a Postgres container on `localhost:5432` with two databases: `workstack` (dev) and `workstack_test` (test), both owned by the `workstack` user.

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set SECRET_KEY to a real secret, e.g.:
python3 -c "import secrets; print(secrets.token_hex(32))"

alembic upgrade head
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now available at `http://localhost:8000`, with routes under `/api/v1`. `GET /health` is a simple liveness check.

Run backend tests (requires the `workstack_test` database from step 1):

```bash
pytest
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app is now available at `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to the backend at `http://localhost:8000`, so the browser sees the frontend and API as the same origin (this keeps the auth cookie simple and secure in development).

Run frontend tests:

```bash
npm run test
```

Build for production:

```bash
npm run build
```

### 4. Try it out

Open `http://localhost:5173` and register an account. With no workspaces yet, you'll land on `/onboarding` to create one. Once you have a workspace, `/` redirects you into it.

To try the invitation flow end-to-end (in two browser profiles, or one browser + an incognito window, since sessions are per-cookie):

1. As the workspace owner, go to the workspace's **Members** page and send an invite by email.
2. There's no email provider yet — the invite URL (`/invite/{token}`) is shown directly on the page after creating the invitation. Copy it.
3. Open that URL as the invited user (registering/logging in with the exact invited email if not already signed in).
4. Accept the invitation — you're added as a `MEMBER` and redirected into the workspace.

## Authentication notes

- Passwords are hashed with `bcrypt`.
- Sessions are JWT access tokens stored in an **httpOnly, SameSite=Lax** cookie (not `localStorage`), issued on register/login and cleared on logout.
- `GET /api/v1/auth/me` returns the currently authenticated user, or `401` if not authenticated.

## Workspace & invitation notes

- Workspace is the multi-tenant boundary: every workspace-scoped endpoint checks the authenticated user's membership before returning anything, and returns `404` (not `403`) to non-members so a workspace's existence isn't leaked to accounts outside it.
- Only `OWNER`s can create invitations; both `OWNER`s and `MEMBER`s can view the workspace and its member list.
- Invitations expire after 7 days, can only be accepted once, and require the accepting account's email to match the invited email (case-insensitive).
- No email provider is integrated yet — invitation links are returned directly in the API response / shown in the UI for local testing.

## Project notes

- Every project belongs to exactly one workspace and can't be moved between workspaces.
- Workspace `OWNER`s can create, edit, and delete projects; `MEMBER`s can view and open them.
- Project access follows the same tenant-isolation convention as workspaces: `/api/v1/projects/{id}` returns `404` (not `403`) if the caller isn't a member of the owning workspace, so a project's existence isn't leaked outside its workspace.

## Sprint notes

- Every sprint belongs to exactly one project; the workspace is derived via `Sprint → Project → Workspace`, not stored directly on the sprint.
- Lifecycle is one-directional: `PLANNED → ACTIVE → COMPLETED`. Status can only change through `POST /sprints/{id}/start` and `POST /sprints/{id}/complete`, never via `PATCH`.
- Only one sprint per project may be `ACTIVE` at a time — enforced both in the API (checked before starting) and at the database level (a partial unique index on `project_id` where `status = 'ACTIVE'`), so a race between two requests can't create two active sprints.
- A `COMPLETED` sprint can't be edited, restarted, or deleted. An `ACTIVE` sprint can't be deleted, only completed.
- Workspace `OWNER`s can create, edit, delete (`PLANNED` only), start, and complete sprints; `MEMBER`s can view them.

## Task & board notes

- Every task belongs to exactly one project and, optionally, one sprint. `sprint_id = NULL` means the task is in the project backlog; a non-null `sprint_id` implies status is `TODO`, `IN_PROGRESS`, or `DONE` — the two are always kept consistent server-side (moving to `BACKLOG` force-nulls the sprint; moving out of the backlog requires picking a sprint).
- Human-readable keys (`PAY-12`) are computed at read time from the project's `key` + a per-project sequential `task_number`, handed out via an atomic `UPDATE ... RETURNING` on the project row so concurrent creates can never collide. The key is never stored as a string.
- `Project.key` is required, uppercase, unique app-wide, and immutable after creation.
- Assignee and reporter are always validated against the task's workspace membership server-side — the assignee dropdown only ever queries that workspace's members, never all users.
- Workspace `OWNER`s can create, view, edit, move, assign, and delete tasks; `MEMBER`s can do everything except delete.
- The Kanban board uses `@dnd-kit/core` for drag-and-drop; moves are optimistic and reconciled with the server response, reverting with an error banner if the backend rejects the move (e.g. an invalid transition).

## What's not implemented yet

Per the product roadmap, comments, activity feeds, and real-time collaboration are out of scope for this milestone and will be built in later phases.
