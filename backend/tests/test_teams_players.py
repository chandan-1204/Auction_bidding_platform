"""Tests for teams and players CRUD."""
import pytest
from httpx import AsyncClient

from tests.conftest import admin_headers, captain_headers


@pytest.mark.asyncio
async def test_create_team(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    resp = await client.post(
        "/api/teams/",
        headers=headers,
        json={
            "name": "Phoenix Rising",
            "tournament_id": tournament.id,
            "captain_name": "Test Captain",
            "total_purse": 5000.0,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Phoenix Rising"
    assert data["total_purse"] == 5000.0
    assert data["available_purse"] == 5000.0
    assert data["spent_amount"] == 0.0


@pytest.mark.asyncio
async def test_list_teams(client: AsyncClient, admin_user, tournament, team):
    headers = await admin_headers(client, admin_user)
    resp = await client.get(
        f"/api/teams/?tournament_id={tournament.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_captain_cannot_view_other_team(client: AsyncClient, captain_user, admin_user, tournament):
    # Create another team
    admin_h = await admin_headers(client, admin_user)
    resp = await client.post(
        "/api/teams/",
        headers=admin_h,
        json={
            "name": "Other Team",
            "tournament_id": tournament.id,
            "total_purse": 5000.0,
        },
    )
    other_team_id = resp.json()["id"]

    # Captain tries to view the other team
    captain_h = await captain_headers(client, captain_user)
    resp = await client.get(f"/api/teams/{other_team_id}", headers=captain_h)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_player(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    resp = await client.post(
        "/api/players/",
        headers=headers,
        json={
            "tournament_id": tournament.id,
            "name": "Test Player",
            "category": "Intermediate",
            "base_price": 500.0,
            "auction_order": 1,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Player"
    assert data["status"] == "AVAILABLE"
    assert data["base_price"] == 500.0


@pytest.mark.asyncio
async def test_list_players(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    resp = await client.get(
        f"/api/players/?tournament_id={tournament.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_update_player(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    # Create player
    resp = await client.post(
        "/api/players/",
        headers=headers,
        json={"tournament_id": tournament.id, "name": "Update Test", "base_price": 300.0, "auction_order": 99},
    )
    player_id = resp.json()["id"]

    # Update
    resp = await client.patch(
        f"/api/players/{player_id}",
        headers=headers,
        json={"base_price": 600.0, "category": "Advanced"},
    )
    assert resp.status_code == 200
    assert resp.json()["base_price"] == 600.0
    assert resp.json()["category"] == "Advanced"


@pytest.mark.asyncio
async def test_delete_player(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    resp = await client.post(
        "/api/players/",
        headers=headers,
        json={"tournament_id": tournament.id, "name": "Delete Me", "base_price": 200.0, "auction_order": 100},
    )
    player_id = resp.json()["id"]

    resp = await client.delete(f"/api/players/{player_id}", headers=headers)
    assert resp.status_code == 204

    resp = await client.get(f"/api/players/{player_id}", headers=headers)
    assert resp.status_code == 404
