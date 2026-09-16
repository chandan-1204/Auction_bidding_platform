"""
Tests for the auction engine — state machine, bidding, purse management.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Auction, Player, Team, User
from app.core.security import hash_password
from tests.conftest import admin_headers, captain_headers, get_token


async def create_auction(client, admin_user, tournament_id, headers):
    resp = await client.post(
        "/api/auctions/",
        headers=headers,
        json={
            "tournament_id": tournament_id,
            "starting_purse": 5000.0,
            "base_price": 500.0,
            "bid_increment": 100.0,
            "timer_seconds": 15,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def create_player(client, tournament_id, headers, name="Test Bidder", order=1):
    resp = await client.post(
        "/api/players/",
        headers=headers,
        json={"tournament_id": tournament_id, "name": name, "base_price": 500.0, "auction_order": order},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_auction(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    data = await create_auction(client, admin_user, tournament.id, headers)
    assert data["state"] == "DRAFT"
    assert data["bid_increment"] == 100.0


@pytest.mark.asyncio
async def test_auction_state_transitions(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]

    # DRAFT → READY (start)
    resp = await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["state"] == "READY"

    # Create player
    player = await create_player(client, tournament.id, headers)

    # READY → LIVE (set player)
    resp = await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)
    assert resp.status_code == 200, resp.text
    state = resp.json()
    assert state["state"] == "LIVE"
    assert state["current_player"]["id"] == player["id"]

    # LIVE → PAUSED
    resp = await client.post(f"/api/auctions/{auction_id}/pause", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["state"] == "PAUSED"

    # PAUSED → LIVE
    resp = await client.post(f"/api/auctions/{auction_id}/resume", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["state"] == "LIVE"


@pytest.mark.asyncio
async def test_invalid_state_transition(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    # Try to pause a DRAFT auction (invalid)
    resp = await client.post(f"/api/auctions/{auction['id']}/pause", headers=headers)
    assert resp.status_code == 400
    assert "INVALID_STATE_TRANSITION" in resp.text


@pytest.mark.asyncio
async def test_place_valid_bid(client: AsyncClient, admin_user, captain_user, tournament, db: AsyncSession):
    headers = await admin_headers(client, admin_user)

    # Setup auction + player
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers)

    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    # Get captain token
    captain_h = await captain_headers(client, captain_user)
    resp = await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 500.0},
    )
    assert resp.status_code == 200, resp.text
    bid = resp.json()
    assert bid["is_accepted"] is True
    assert bid["amount"] == 500.0


@pytest.mark.asyncio
async def test_bid_too_low_rejected(client: AsyncClient, admin_user, captain_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="LowBidPlayer", order=50)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    captain_h = await captain_headers(client, captain_user)
    # Bid below base price
    resp = await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 100.0},
    )
    assert resp.status_code == 400
    assert "BID_TOO_LOW" in resp.text


@pytest.mark.asyncio
async def test_insufficient_purse_rejected(client: AsyncClient, admin_user, captain_user, tournament, db: AsyncSession):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="RichPlayer", order=60)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    # Drain the captain's team purse to 0
    result = await db.execute(select(Team).where(Team.id == captain_user.team_id))
    team = result.scalar_one_or_none()
    if team:
        team.spent_amount = 5000.0
        await db.flush()

    captain_h = await captain_headers(client, captain_user)
    resp = await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 500.0},
    )
    assert resp.status_code == 400
    assert "INSUFFICIENT_PURSE" in resp.text


@pytest.mark.asyncio
async def test_sold_player_updates_team_purse(client: AsyncClient, admin_user, captain_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="SoldPlayer", order=70)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    # Place bid
    captain_h = await captain_headers(client, captain_user)
    await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 700.0},
    )

    # Mark sold
    resp = await client.post(f"/api/auctions/{auction_id}/sold", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["state"] == "SOLD"

    # Verify team purse
    team_resp = await client.get(f"/api/teams/{captain_user.team_id}", headers=captain_h)
    team_data = team_resp.json()
    assert team_data["spent_amount"] == 700.0
    assert team_data["available_purse"] == 4300.0  # 5000 - 700
    assert team_data["reserved_amount"] == 0.0


@pytest.mark.asyncio
async def test_unsold_releases_reservation(client: AsyncClient, admin_user, captain_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="UnsoldPlayer", order=80)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    captain_h = await captain_headers(client, captain_user)
    await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 500.0},
    )

    # Mark unsold
    resp = await client.post(f"/api/auctions/{auction_id}/unsold", headers=headers)
    assert resp.status_code == 200

    # Reservation should be released
    team_resp = await client.get(f"/api/teams/{captain_user.team_id}", headers=captain_h)
    team_data = team_resp.json()
    assert team_data["reserved_amount"] == 0.0
    assert team_data["spent_amount"] == 0.0
    assert team_data["available_purse"] == 5000.0


@pytest.mark.asyncio
async def test_captain_already_highest_bidder_rejected(client: AsyncClient, admin_user, captain_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="HighestBidderTest", order=90)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    captain_h = await captain_headers(client, captain_user)
    # First bid succeeds
    await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 500.0},
    )
    # Second bid by same team is rejected
    resp = await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 600.0},
    )
    assert resp.status_code == 400
    assert "TEAM_ALREADY_HIGHEST" in resp.text


@pytest.mark.asyncio
async def test_bid_while_paused_rejected(client: AsyncClient, admin_user, captain_user, tournament):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="PauseTest", order=95)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/pause", headers=headers)

    captain_h = await captain_headers(client, captain_user)
    resp = await client.post(
        f"/api/auctions/{auction_id}/bid",
        headers=captain_h,
        json={"auction_id": auction_id, "amount": 500.0},
    )
    assert resp.status_code == 400
    assert "AUCTION_PAUSED" in resp.text


@pytest.mark.asyncio
async def test_admin_sell_directly_to_team_without_prior_bids(
    client: AsyncClient, admin_user, captain_user, tournament
):
    headers = await admin_headers(client, admin_user)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]
    player = await create_player(client, tournament.id, headers, name="DirectSoldPlayer", order=99)
    await client.post(f"/api/auctions/{auction_id}/start", headers=headers)
    await client.post(f"/api/auctions/{auction_id}/player/{player['id']}", headers=headers)

    # Admin raises bid manually to 1500 without a team
    await client.post(f"/api/auctions/{auction_id}/admin-bid?amount=1500", headers=headers)

    # Admin sells directly to captain_user's team
    sold_resp = await client.post(
        f"/api/auctions/{auction_id}/sold",
        headers=headers,
        json={"team_id": captain_user.team_id},
    )
    assert sold_resp.status_code == 200
    data = sold_resp.json()
    assert data["state"] == "SOLD"
    assert data["highest_bidder_team_id"] == captain_user.team_id
    assert data["current_bid"] == 1500.0


@pytest.mark.asyncio
async def test_draft_auction_active_retrieval(client: AsyncClient, admin_user, tournament):
    headers = await admin_headers(client, admin_user)
    # Create auction (creates in DRAFT state)
    auction = await create_auction(client, admin_user, tournament.id, headers)
    auction_id = auction["id"]

    # Retrieve active auction for tournament — should return the draft auction
    active_resp = await client.get(
        f"/api/auctions/active?tournament_id={tournament.id}", headers=headers
    )
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data is not None
    assert active_data["id"] == auction_id
    assert active_data["state"] == "DRAFT"

