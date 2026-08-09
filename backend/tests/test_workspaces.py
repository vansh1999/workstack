from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.workspace import WorkspaceInvitation


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


def create_invitation(client: TestClient, workspace_id: str, email: str) -> dict:
    response = client.post(f"/api/v1/workspaces/{workspace_id}/invitations", json={"email": email})
    assert response.status_code == 201
    return response.json()


def invite_token(invite_url: str) -> str:
    return invite_url.rsplit("/", 1)[-1]


def test_create_workspace_and_creator_becomes_owner(client: TestClient) -> None:
    register(client, "owner@example.com")

    workspace = create_workspace(client)

    assert workspace["name"] == "Acme Engineering"
    assert workspace["role"] == "OWNER"


def test_user_can_list_their_workspaces(client: TestClient) -> None:
    register(client, "owner@example.com")
    create_workspace(client, "Workspace One")
    create_workspace(client, "Workspace Two")

    response = client.get("/api/v1/workspaces")

    assert response.status_code == 200
    names = [w["name"] for w in response.json()]
    assert names == ["Workspace One", "Workspace Two"]


def test_user_cannot_access_workspace_they_do_not_belong_to(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    other_client = TestClient(app)
    register(other_client, "outsider@example.com")

    response = other_client.get(f"/api/v1/workspaces/{workspace['id']}")

    assert response.status_code == 404


def test_user_cannot_list_members_of_workspace_they_do_not_belong_to(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    other_client = TestClient(app)
    register(other_client, "outsider@example.com")

    response = other_client.get(f"/api/v1/workspaces/{workspace['id']}/members")

    assert response.status_code == 404


def test_owner_can_list_members(client: TestClient) -> None:
    register(client, "owner@example.com", full_name="Owner Person")
    workspace = create_workspace(client)

    response = client.get(f"/api/v1/workspaces/{workspace['id']}/members")

    assert response.status_code == 200
    members = response.json()
    assert len(members) == 1
    assert members[0]["role"] == "OWNER"
    assert members[0]["user"]["email"] == "owner@example.com"


def test_owner_can_create_invitation(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    invitation = create_invitation(client, workspace["id"], "invitee@example.com")

    assert invitation["email"] == "invitee@example.com"
    assert invitation["invite_url"].startswith("http://localhost:5173/invite/")
    token = invite_token(invitation["invite_url"])
    assert len(token) >= 32


def test_non_owner_cannot_create_invitation(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "member@example.com")

    member_client = TestClient(app)
    register(member_client, "member@example.com")
    accept_response = member_client.post(f"/api/v1/invitations/{invite_token(invitation['invite_url'])}/accept")
    assert accept_response.status_code == 200

    response = member_client.post(
        f"/api/v1/workspaces/{workspace['id']}/invitations", json={"email": "someone@example.com"}
    )

    assert response.status_code == 403


def test_outsider_cannot_create_invitation(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    outsider_client = TestClient(app)
    register(outsider_client, "outsider@example.com")

    response = outsider_client.post(
        f"/api/v1/workspaces/{workspace['id']}/invitations", json={"email": "someone@example.com"}
    )

    assert response.status_code == 404


def test_valid_invitation_can_be_accepted(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")

    invitee_client = TestClient(app)
    register(invitee_client, "invitee@example.com")

    response = invitee_client.post(f"/api/v1/invitations/{invite_token(invitation['invite_url'])}/accept")

    assert response.status_code == 200
    assert response.json()["workspace"]["role"] == "MEMBER"

    members_response = client.get(f"/api/v1/workspaces/{workspace['id']}/members")
    emails = {m["user"]["email"] for m in members_response.json()}
    assert emails == {"owner@example.com", "invitee@example.com"}


def test_invitation_email_must_match_authenticated_user(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")

    wrong_user_client = TestClient(app)
    register(wrong_user_client, "someone-else@example.com")

    response = wrong_user_client.post(
        f"/api/v1/invitations/{invite_token(invitation['invite_url'])}/accept"
    )

    assert response.status_code == 403


def test_expired_invitation_is_rejected(client: TestClient, db_session: Session) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")
    token = invite_token(invitation["invite_url"])

    db_invitation = db_session.query(WorkspaceInvitation).filter_by(token=token).one()
    db_invitation.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()

    invitee_client = TestClient(app)
    register(invitee_client, "invitee@example.com")

    response = invitee_client.post(f"/api/v1/invitations/{token}/accept")

    assert response.status_code == 410


def test_already_accepted_invitation_is_rejected(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")
    token = invite_token(invitation["invite_url"])

    invitee_client = TestClient(app)
    register(invitee_client, "invitee@example.com")
    first_response = invitee_client.post(f"/api/v1/invitations/{token}/accept")
    assert first_response.status_code == 200

    second_response = invitee_client.post(f"/api/v1/invitations/{token}/accept")

    assert second_response.status_code == 409


def test_duplicate_workspace_membership_is_prevented(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)

    invitee_client = TestClient(app)
    register(invitee_client, "invitee@example.com")

    first_invitation = create_invitation(client, workspace["id"], "invitee@example.com")
    accept_response = invitee_client.post(
        f"/api/v1/invitations/{invite_token(first_invitation['invite_url'])}/accept"
    )
    assert accept_response.status_code == 200

    second_invitation = create_invitation(client, workspace["id"], "invitee@example.com")
    second_accept_response = invitee_client.post(
        f"/api/v1/invitations/{invite_token(second_invitation['invite_url'])}/accept"
    )

    assert second_accept_response.status_code == 409

    members_response = client.get(f"/api/v1/workspaces/{workspace['id']}/members")
    assert len(members_response.json()) == 2


def test_get_invitation_requires_authentication(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client)
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")

    anonymous_client = TestClient(app)
    response = anonymous_client.get(f"/api/v1/invitations/{invite_token(invitation['invite_url'])}")

    assert response.status_code == 401


def test_get_invitation_shows_workspace_name_and_email(client: TestClient) -> None:
    register(client, "owner@example.com")
    workspace = create_workspace(client, "Acme Engineering")
    invitation = create_invitation(client, workspace["id"], "invitee@example.com")

    invitee_client = TestClient(app)
    register(invitee_client, "invitee@example.com")

    response = invitee_client.get(f"/api/v1/invitations/{invite_token(invitation['invite_url'])}")

    assert response.status_code == 200
    body = response.json()
    assert body["workspace_name"] == "Acme Engineering"
    assert body["email"] == "invitee@example.com"
    assert body["status"] == "pending"
