from fastapi.testclient import TestClient

from app.main import app


def register(client: TestClient, email: str, full_name: str = "Test User") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()


def create_workspace(client: TestClient, name: str = "Acme Engineering") -> dict:
    response = client.post("/api/v1/workspaces", json={"name": name})
    assert response.status_code == 201
    return response.json()


def invite_token(invite_url: str) -> str:
    return invite_url.rsplit("/", 1)[-1]


def add_member(owner_client: TestClient, workspace_id: str, email: str) -> TestClient:
    """Registers a new user and joins them to the workspace as a MEMBER."""
    invitation_response = owner_client.post(
        f"/api/v1/workspaces/{workspace_id}/invitations", json={"email": email}
    )
    assert invitation_response.status_code == 201

    member_client = TestClient(app)
    register(member_client, email)
    accept_response = member_client.post(
        f"/api/v1/invitations/{invite_token(invitation_response.json()['invite_url'])}/accept"
    )
    assert accept_response.status_code == 200
    return member_client


def create_project(
    client: TestClient, workspace_id: str, name: str = "Payment Platform", key: str = "PAY"
) -> dict:
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects", json={"name": name, "key": key}
    )
    assert response.status_code == 201
    return response.json()


def create_sprint(
    client: TestClient,
    project_id: str,
    name: str = "Sprint 1",
    start_date: str = "2026-08-10",
    end_date: str = "2026-08-23",
) -> dict:
    response = client.post(
        f"/api/v1/projects/{project_id}/sprints",
        json={"name": name, "start_date": start_date, "end_date": end_date},
    )
    assert response.status_code == 201
    return response.json()


def create_task(client: TestClient, project_id: str, **overrides) -> dict:
    payload = {"title": "Implement payment retry"}
    payload.update(overrides)
    response = client.post(f"/api/v1/projects/{project_id}/tasks", json=payload)
    assert response.status_code == 201
    return response.json()


def setup_owner_workspace_and_project(client: TestClient) -> tuple[dict, dict]:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    return workspace, project


def test_workspace_member_can_create_a_task(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.post(
        f"/api/v1/projects/{project['id']}/tasks", json={"title": "Fix login bug"}
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Fix login bug"


def test_workspace_member_can_view_tasks(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    create_task(client, project["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.get(f"/api/v1/projects/{project['id']}/tasks")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_workspace_owner_can_delete_a_task(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])

    response = client.delete(f"/api/v1/tasks/{task['id']}")
    assert response.status_code == 204

    get_response = client.get(f"/api/v1/tasks/{task['id']}")
    assert get_response.status_code == 404


def test_workspace_member_cannot_delete_a_task(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.delete(f"/api/v1/tasks/{task['id']}")

    assert response.status_code == 403

    still_there = client.get(f"/api/v1/tasks/{task['id']}")
    assert still_there.status_code == 200


def test_task_reporter_is_the_authenticated_user_on_creation(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    member_client = add_member(client, workspace["id"], "member@example.com")

    task = create_task(member_client, project["id"], title="Reported by member")

    assert task["reporter"]["email"] == "member@example.com"


def test_assignee_must_belong_to_the_workspace(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)

    outsider_client = TestClient(app)
    outsider = register(outsider_client, "outsider@example.com")

    response = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Bad assignment", "assignee_id": outsider["id"]},
    )

    assert response.status_code == 422


def test_reporter_must_belong_to_the_workspace(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    member_client = add_member(client, workspace["id"], "member@example.com")

    task = create_task(member_client, project["id"], title="Reported by member")

    members = client.get(f"/api/v1/workspaces/{workspace['id']}/members").json()
    member_emails = {m["user"]["email"] for m in members}
    assert task["reporter"]["email"] in member_emails


def test_sprint_must_belong_to_the_same_project(client: TestClient) -> None:
    workspace, project_a = setup_owner_workspace_and_project(client)
    project_b = create_project(client, workspace["id"], name="Mobile App", key="MOB")
    sprint_b = create_sprint(client, project_b["id"])

    response = client.post(
        f"/api/v1/projects/{project_a['id']}/tasks",
        json={"title": "Cross-project sprint", "sprint_id": sprint_b["id"]},
    )

    assert response.status_code == 422


def test_task_project_must_be_accessible_to_the_current_user(client: TestClient) -> None:
    workspace, project = setup_owner_workspace_and_project(client)
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.get(f"/api/v1/projects/{project['id']}/tasks")

    assert response.status_code == 200


def test_user_from_another_workspace_cannot_access_the_task(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.get(f"/api/v1/tasks/{task['id']}")

    assert response.status_code == 404


def test_task_can_exist_in_backlog_with_sprint_id_null(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)

    task = create_task(client, project["id"])

    assert task["sprint_id"] is None
    assert task["status"] == "BACKLOG"


def test_task_created_with_a_sprint_starts_as_todo(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    sprint = create_sprint(client, project["id"])

    task = create_task(client, project["id"], sprint_id=sprint["id"])

    assert task["sprint_id"] == sprint["id"]
    assert task["status"] == "TODO"


def test_backlog_requires_sprint_id_null(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    sprint = create_sprint(client, project["id"])
    task = create_task(client, project["id"], sprint_id=sprint["id"])

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "BACKLOG"})

    assert response.status_code == 200
    assert response.json()["status"] == "BACKLOG"
    assert response.json()["sprint_id"] is None


def test_todo_requires_a_sprint(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "TODO"})

    assert response.status_code == 422


def test_in_progress_requires_a_sprint(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "IN_PROGRESS"})

    assert response.status_code == 422


def test_done_requires_a_sprint(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    task = create_task(client, project["id"])

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "DONE"})

    assert response.status_code == 422


def test_moving_a_task_to_backlog_removes_its_sprint(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    sprint = create_sprint(client, project["id"])
    task = create_task(client, project["id"], sprint_id=sprint["id"])
    assert task["status"] == "TODO"

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "BACKLOG"})

    assert response.status_code == 200
    assert response.json()["sprint_id"] is None
    assert response.json()["status"] == "BACKLOG"


def test_moving_a_backlog_task_into_a_sprint_assigns_that_sprint(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)
    sprint = create_sprint(client, project["id"])
    task = create_task(client, project["id"])
    assert task["sprint_id"] is None

    response = client.patch(
        f"/api/v1/tasks/{task['id']}", json={"status": "TODO", "sprint_id": sprint["id"]}
    )

    assert response.status_code == 200
    assert response.json()["sprint_id"] == sprint["id"]
    assert response.json()["status"] == "TODO"


def test_task_number_generation_never_produces_duplicates(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)

    tasks = [create_task(client, project["id"], title=f"Task {i}") for i in range(5)]

    keys = [t["key"] for t in tasks]
    assert len(keys) == len(set(keys))
    assert keys == ["PAY-1", "PAY-2", "PAY-3", "PAY-4", "PAY-5"]


def test_task_key_is_displayed_correctly(client: TestClient) -> None:
    _workspace, project = setup_owner_workspace_and_project(client)

    task = create_task(client, project["id"])

    assert task["key"] == f"{project['key']}-1"
