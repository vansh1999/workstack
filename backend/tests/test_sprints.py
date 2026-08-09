from datetime import date

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
        json={
            "name": name,
            "goal": "Complete authentication and workspace management",
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    assert response.status_code == 201
    return response.json()


def setup_owner_project(client: TestClient) -> dict:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    return create_project(client, workspace["id"])


def test_workspace_owner_can_create_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)

    sprint = create_sprint(client, project["id"])

    assert sprint["name"] == "Sprint 1"
    assert sprint["project_id"] == project["id"]
    assert sprint["status"] == "PLANNED"


def test_workspace_member_cannot_create_sprint(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.post(
        f"/api/v1/projects/{project['id']}/sprints",
        json={"name": "Sneaky Sprint", "start_date": "2026-08-10", "end_date": "2026-08-23"},
    )

    assert response.status_code == 403


def test_workspace_member_can_view_sprints(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    create_sprint(client, project["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.get(f"/api/v1/projects/{project['id']}/sprints")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Sprint 1"


def test_workspace_owner_can_edit_planned_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])

    response = client.patch(
        f"/api/v1/sprints/{sprint['id']}",
        json={"name": "Sprint 1 Renamed", "goal": "Updated goal"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Sprint 1 Renamed"
    assert response.json()["goal"] == "Updated goal"


def test_workspace_owner_can_start_planned_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])

    response = client.post(f"/api/v1/sprints/{sprint['id']}/start")

    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"


def test_planned_to_active_transition_works(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    assert sprint["status"] == "PLANNED"

    client.post(f"/api/v1/sprints/{sprint['id']}/start")

    fetched = client.get(f"/api/v1/sprints/{sprint['id']}")
    assert fetched.json()["status"] == "ACTIVE"


def test_cannot_start_a_sprint_that_is_already_active(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")

    response = client.post(f"/api/v1/sprints/{sprint['id']}/start")

    assert response.status_code == 409


def test_cannot_have_two_active_sprints_in_one_project(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint_a = create_sprint(client, project["id"], name="Sprint A")
    sprint_b = create_sprint(
        client, project["id"], name="Sprint B", start_date="2026-09-01", end_date="2026-09-14"
    )
    client.post(f"/api/v1/sprints/{sprint_a['id']}/start")

    response = client.post(f"/api/v1/sprints/{sprint_b['id']}/start")

    assert response.status_code == 409


def test_workspace_owner_can_complete_active_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")

    response = client.post(f"/api/v1/sprints/{sprint['id']}/complete")

    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"


def test_active_to_completed_transition_works(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")
    client.post(f"/api/v1/sprints/{sprint['id']}/complete")

    fetched = client.get(f"/api/v1/sprints/{sprint['id']}")
    assert fetched.json()["status"] == "COMPLETED"


def test_cannot_complete_a_planned_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])

    response = client.post(f"/api/v1/sprints/{sprint['id']}/complete")

    assert response.status_code == 409


def test_cannot_edit_completed_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")
    client.post(f"/api/v1/sprints/{sprint['id']}/complete")

    response = client.patch(f"/api/v1/sprints/{sprint['id']}", json={"name": "New name"})

    assert response.status_code == 409


def test_cannot_delete_active_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")

    response = client.delete(f"/api/v1/sprints/{sprint['id']}")

    assert response.status_code == 409


def test_cannot_delete_completed_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])
    client.post(f"/api/v1/sprints/{sprint['id']}/start")
    client.post(f"/api/v1/sprints/{sprint['id']}/complete")

    response = client.delete(f"/api/v1/sprints/{sprint['id']}")

    assert response.status_code == 409


def test_can_delete_planned_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])

    response = client.delete(f"/api/v1/sprints/{sprint['id']}")
    assert response.status_code == 204

    fetched = client.get(f"/api/v1/sprints/{sprint['id']}")
    assert fetched.status_code == 404


def test_user_from_another_workspace_cannot_access_the_sprint(client: TestClient) -> None:
    project = setup_owner_project(client)
    sprint = create_sprint(client, project["id"])

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.get(f"/api/v1/sprints/{sprint['id']}")

    assert response.status_code == 404


def test_user_from_another_workspace_cannot_access_the_project_containing_the_sprint(
    client: TestClient,
) -> None:
    project = setup_owner_project(client)
    create_sprint(client, project["id"])

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.get(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 404


def test_end_date_must_be_after_start_date(client: TestClient) -> None:
    project = setup_owner_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/sprints",
        json={"name": "Bad Sprint", "start_date": "2026-08-23", "end_date": "2026-08-10"},
    )

    assert response.status_code == 422
