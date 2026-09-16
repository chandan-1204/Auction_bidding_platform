"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import admin_headers, get_token


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/auth/login",
        json={"username": admin_user.username, "password": "adminpass"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["username"] == admin_user.username


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/auth/login",
        json={"username": admin_user.username, "password": "wrongpassword"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_unknown_user(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "nothing"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, admin_user):
    headers = await admin_headers(client, admin_user)
    resp = await client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == admin_user.username
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_user_as_admin(client: AsyncClient, admin_user, tournament, team):
    headers = await admin_headers(client, admin_user)
    resp = await client.post(
        "/api/auth/register",
        headers=headers,
        json={
            "username": "newcaptain",
            "email": "newcaptain@test.com",
            "password": "securepass",
            "role": "captain",
            "team_id": team.id,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "newcaptain"
    assert data["role"] == "captain"


@pytest.mark.asyncio
async def test_register_user_as_captain_forbidden(client: AsyncClient, captain_user):
    headers = await captain_headers(client, captain_user)
    resp = await client.post(
        "/api/auth/register",
        headers=headers,
        json={
            "username": "anotheruser",
            "email": "anotheruser@test.com",
            "password": "securepass",
            "role": "captain",
        },
    )
    assert resp.status_code == 403


from tests.conftest import captain_headers
