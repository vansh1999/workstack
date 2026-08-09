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
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": name, "key": key, "description": "Payment infrastructure and services"},
    )
    assert response.status_code == 201
    return response.json()


def test_workspace_member_can_list_projects(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    create_project(client, workspace["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.get(f"/api/v1/workspaces/{workspace['id']}/projects")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Payment Platform"


def test_workspace_member_can_view_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.get(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == "Payment Platform"
    assert response.json()["role"] == "MEMBER"


def test_workspace_owner_can_create_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    project = create_project(client, workspace["id"])

    assert project["name"] == "Payment Platform"
    assert project["workspace_id"] == workspace["id"]
    assert project["role"] == "OWNER"


def test_workspace_member_cannot_create_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.post(
        f"/api/v1/workspaces/{workspace['id']}/projects", json={"name": "Mobile App", "key": "MOB"}
    )

    assert response.status_code == 403


def test_workspace_owner_can_edit_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])

    response = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Payments", "description": "Updated description"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Payments"
    assert response.json()["description"] == "Updated description"


def test_workspace_member_cannot_edit_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.patch(
        f"/api/v1/projects/{project['id']}", json={"name": "Hijacked"}
    )

    assert response.status_code == 403


def test_workspace_owner_can_delete_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])

    response = client.delete(f"/api/v1/projects/{project['id']}")
    assert response.status_code == 204

    get_response = client.get(f"/api/v1/projects/{project['id']}")
    assert get_response.status_code == 404


def test_workspace_member_cannot_delete_a_project(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])
    member_client = add_member(client, workspace["id"], "member@example.com")

    response = member_client.delete(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 403

    still_there = client.get(f"/api/v1/projects/{project['id']}")
    assert still_there.status_code == 200


def test_outsider_cannot_list_workspace_projects(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    create_project(client, workspace["id"])

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.get(f"/api/v1/workspaces/{workspace['id']}/projects")

    assert response.status_code == 404


def test_outsider_cannot_access_a_project_directly(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    project = create_project(client, workspace["id"])

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.get(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 404


def test_project_belongs_to_the_correct_workspace(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace_a = create_workspace(client, "Workspace A")
    workspace_b = create_workspace(client, "Workspace B")

    project_a = create_project(client, workspace_a["id"], "Project A1")

    assert project_a["workspace_id"] == workspace_a["id"]
    assert project_a["workspace_id"] != workspace_b["id"]

    workspace_a_projects = client.get(f"/api/v1/workspaces/{workspace_a['id']}/projects").json()
    workspace_b_projects = client.get(f"/api/v1/workspaces/{workspace_b['id']}/projects").json()

    assert [p["name"] for p in workspace_a_projects] == ["Project A1"]
    assert workspace_b_projects == []


def test_project_cannot_be_created_against_a_workspace_the_user_does_not_belong_to(
    client: TestClient,
) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.post(
        f"/api/v1/workspaces/{workspace['id']}/projects",
        json={"name": "Sneaky Project", "key": "SNK"},
    )

    assert response.status_code == 404
