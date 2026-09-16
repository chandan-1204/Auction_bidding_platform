"""
Comprehensive production-readiness, security, concurrency, and edge case test suite.
Audits the complete tournament flow, concurrent captain bidding, purse invariants,
server timer authority, and role-based permissions.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.models import Auction, Player, Team, Tournament, User
from tests.conftest import admin_headers, captain_headers, create_async_engine


async def create_fixture_team(db: AsyncSession, tournament_id: str, name: str, purse: float = 5000.0) -> tuple[Team, User]:
    team = Team(
        tournament_id=tournament_id,
        name=name,
        total_purse=purse,
        spent_amount=0.0,
        reserved_amount=0.0,
    )
    db.add(team)
    await db.flush()

    user = User(
        username=name.lower().replace(" ", "_"),
        email=f"{name.lower().replace(' ', '_')}@test.com",
        hashed_password=hash_password("captainpass"),
        role="captain",
        team_id=team.id,
    )
    db.add(user)
    await db.flush()
    return team, user


async def check_all_purse_invariants(db: AsyncSession):
    """Verify available_purse = total - spent - reserved and spent + reserved <= total for all teams."""
    result = await db.execute(select(Team))
    teams = result.scalars().all()
    for team in teams:
        assert team.spent_amount >= 0.0, f"Team {team.name} has negative spent_amount"
        assert team.reserved_amount >= 0.0, f"Team {team.name} has negative reserved_amount"
        assert team.spent_amount + team.reserved_amount <= team.total_purse + 0.001, (
            f"Purse invariant violated for {team.name}: spent({team.spent_amount}) + "
            f"reserved({team.reserved_amount}) > total({team.total_purse})"
        )
        assert abs(team.available_purse - (team.total_purse - team.spent_amount - team.reserved_amount)) < 0.001


# ── 1. Concurrent Bidding with 3 Captains ─────────────────────────────────────

@pytest.mark.asyncio
async def test_three_concurrent_captains_bidding(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """
    Test with 3 simulated captain clients bidding simultaneously.
    Verifies that row-level locking prevents race conditions and only one bid wins,
    purses remain invariant, and reservations are strictly correct.
    """
    admin_h = await admin_headers(client, admin_user)

    # Create 3 teams with captains
    team1, cap1 = await create_fixture_team(db, tournament.id, "Concurrent Tigers", 5000.0)
    team2, cap2 = await create_fixture_team(db, tournament.id, "Concurrent Lions", 5000.0)
    team3, cap3 = await create_fixture_team(db, tournament.id, "Concurrent Eagles", 5000.0)

    # Setup auction
    resp = await client.post(
        "/api/auctions/",
        headers=admin_h,
        json={
            "tournament_id": tournament.id,
            "starting_purse": 5000.0,
            "base_price": 500.0,
            "bid_increment": 100.0,
            "timer_seconds": 15,
        },
    )
    auction_id = resp.json()["id"]

    # Create player
    resp = await client.post(
        "/api/players/",
        headers=admin_h,
        json={"tournament_id": tournament.id, "name": "Star Striker", "base_price": 500.0, "auction_order": 1},
    )
    player_id = resp.json()["id"]

    # Start auction & set player
    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    cap1_h = await captain_headers(client, cap1)
    cap2_h = await captain_headers(client, cap2)
    cap3_h = await captain_headers(client, cap3)

    # Opening bid by Captain 1 (500)
    resp1 = await client.post(f"/api/auctions/{auction_id}/bid", headers=cap1_h, json={"auction_id": auction_id, "amount": 500.0})
    assert resp1.status_code == 200

    # Verify team 1 has 500 reserved
    await db.refresh(team1)
    assert team1.reserved_amount == 500.0
    await check_all_purse_invariants(db)

    # Simultaneous bid attempt for the same next amount (600.0) by Captain 2 and Captain 3
    results = await asyncio.gather(
        client.post(f"/api/auctions/{auction_id}/bid", headers=cap2_h, json={"auction_id": auction_id, "amount": 600.0}),
        client.post(f"/api/auctions/{auction_id}/bid", headers=cap3_h, json={"auction_id": auction_id, "amount": 600.0}),
        return_exceptions=False,
    )

    statuses = [r.status_code for r in results]
    # Exactly one must succeed (200) and the other must be rejected (400) because minimum bid advanced
    assert statuses.count(200) == 1, f"Expected exactly one 200, got {statuses}"
    assert statuses.count(400) == 1, f"Expected exactly one 400, got {statuses}"

    # Verify that Captain 1's previous reservation (500) was fully released
    await db.refresh(team1)
    await db.refresh(team2)
    await db.refresh(team3)
    assert team1.reserved_amount == 0.0, "Previous bidder reservation must be released upon outbid"

    # Verify that only the winning team has exactly 600 reserved
    winning_team = team2 if statuses[0] == 200 else team3
    losing_team = team3 if statuses[0] == 200 else team2
    assert winning_team.reserved_amount == 600.0
    assert losing_team.reserved_amount == 0.0

    # Invariants must strictly hold
    await check_all_purse_invariants(db)

    # Now Captain 1 outbids with 700.0
    resp_outbid = await client.post(f"/api/auctions/{auction_id}/bid", headers=cap1_h, json={"auction_id": auction_id, "amount": 700.0})
    assert resp_outbid.status_code == 200

    await db.refresh(team1)
    await db.refresh(winning_team)
    assert team1.reserved_amount == 700.0
    assert winning_team.reserved_amount == 0.0

    # Admin marks player SOLD
    resp_sold = await client.post(f"/api/auctions/{auction_id}/sold", headers=admin_h)
    assert resp_sold.status_code == 200
    assert resp_sold.json()["state"] == "SOLD"

    # Check team 1 spent amount converted from reservation
    await db.refresh(team1)
    assert team1.spent_amount == 700.0
    assert team1.reserved_amount == 0.0
    assert team1.available_purse == 4300.0

    await check_all_purse_invariants(db)


# ── 2. Edge Case: Rapid Double-Click by Same Captain ─────────────────────────

@pytest.mark.asyncio
async def test_rapid_double_bid_by_same_captain(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Captain clicks BID twice in rapid succession -> second request is rejected."""
    admin_h = await admin_headers(client, admin_user)
    team, cap = await create_fixture_team(db, tournament.id, "Fast Clickers", 5000.0)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "Rapid Player", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    cap_h = await captain_headers(client, cap)

    # First bid succeeds
    r1 = await client.post(f"/api/auctions/{auction_id}/bid", headers=cap_h, json={"auction_id": auction_id, "amount": 500.0})
    assert r1.status_code == 200

    # Rapid second bid by same captain is rejected
    r2 = await client.post(f"/api/auctions/{auction_id}/bid", headers=cap_h, json={"auction_id": auction_id, "amount": 600.0})
    assert r2.status_code == 400
    assert "TEAM_ALREADY_HIGHEST" in r2.text

    await check_all_purse_invariants(db)


# ── 3. Edge Case: Timer Reaches Zero (Server Authoritative) ───────────────────

@pytest.mark.asyncio
async def test_bid_after_server_timer_expires(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """A bid submitted after the server timer_end_at is rejected as AUCTION_EXPIRED."""
    admin_h = await admin_headers(client, admin_user)
    team, cap = await create_fixture_team(db, tournament.id, "Late Bidders", 5000.0)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "Expired Player", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    # Force the timer to have expired in the past
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one()
    auction.timer_end_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    await db.flush()

    cap_h = await captain_headers(client, cap)
    r = await client.post(f"/api/auctions/{auction_id}/bid", headers=cap_h, json={"auction_id": auction_id, "amount": 500.0})
    assert r.status_code == 400
    assert "AUCTION_EXPIRED" in r.text


# ── 4. Edge Case: Admin Clicks SOLD Without a Bidder ──────────────────────────

@pytest.mark.asyncio
async def test_admin_cannot_sell_without_bidder(
    client: AsyncClient, admin_user: User, tournament: Tournament
):
    """Admin tries to click SOLD before any bids are placed -> rejected with NO_BIDDER."""
    admin_h = await admin_headers(client, admin_user)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "Unbid Player", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    # Admin clicks SOLD with no bidder
    r = await client.post(f"/api/auctions/{auction_id}/sold", headers=admin_h)
    assert r.status_code == 400
    assert "NO_BIDDER" in r.text


# ── 5. Edge Case: Admin Clicks SOLD Twice ─────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_clicks_sold_twice(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Admin clicks SOLD twice in quick succession -> second call is rejected gracefully."""
    admin_h = await admin_headers(client, admin_user)
    team, cap = await create_fixture_team(db, tournament.id, "Sold Twice Team", 5000.0)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "Sold Player", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    cap_h = await captain_headers(client, cap)
    await client.post(f"/api/auctions/{auction_id}/bid", headers=cap_h, json={"auction_id": auction_id, "amount": 500.0})

    # First SOLD succeeds
    r1 = await client.post(f"/api/auctions/{auction_id}/sold", headers=admin_h)
    assert r1.status_code == 200

    # Second SOLD fails
    r2 = await client.post(f"/api/auctions/{auction_id}/sold", headers=admin_h)
    assert r2.status_code == 400
    assert "INVALID_STATE_TRANSITION" in r2.text

    await check_all_purse_invariants(db)


# ── 6. Edge Case: Skip Player With Active Bids ────────────────────────────────

@pytest.mark.asyncio
async def test_skip_player_releases_reservation(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Admin skips an active player who already has bids -> team reservation is safely refunded."""
    admin_h = await admin_headers(client, admin_user)
    team, cap = await create_fixture_team(db, tournament.id, "Skipped Bidder", 5000.0)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "To Be Skipped", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    cap_h = await captain_headers(client, cap)
    await client.post(f"/api/auctions/{auction_id}/bid", headers=cap_h, json={"auction_id": auction_id, "amount": 500.0})

    await db.refresh(team)
    assert team.reserved_amount == 500.0

    # Admin skips player
    r = await client.post(f"/api/auctions/{auction_id}/skip", headers=admin_h)
    assert r.status_code == 200
    assert r.json()["state"] == "READY"

    # Reservation must be restored to 0
    await db.refresh(team)
    assert team.reserved_amount == 0.0
    assert team.available_purse == 5000.0

    await check_all_purse_invariants(db)


# ── 7. Edge Case: Undo After Multiple Bids ────────────────────────────────────

@pytest.mark.asyncio
async def test_undo_multiple_bids_restores_previous_state(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Undo correctly cascades back to the previous bidder and restores reservations."""
    admin_h = await admin_headers(client, admin_user)
    team1, cap1 = await create_fixture_team(db, tournament.id, "Undo Team A", 5000.0)
    team2, cap2 = await create_fixture_team(db, tournament.id, "Undo Team B", 5000.0)

    resp = await client.post("/api/auctions/", headers=admin_h, json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15})
    auction_id = resp.json()["id"]

    resp = await client.post("/api/players/", headers=admin_h, json={"tournament_id": tournament.id, "name": "Undoable Player", "base_price": 500.0, "auction_order": 1})
    player_id = resp.json()["id"]

    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    cap1_h = await captain_headers(client, cap1)
    cap2_h = await captain_headers(client, cap2)

    # Team 1 bids 500
    await client.post(f"/api/auctions/{auction_id}/bid", headers=cap1_h, json={"auction_id": auction_id, "amount": 500.0})
    # Team 2 bids 600
    await client.post(f"/api/auctions/{auction_id}/bid", headers=cap2_h, json={"auction_id": auction_id, "amount": 600.0})

    await db.refresh(team1)
    await db.refresh(team2)
    assert team1.reserved_amount == 0.0
    assert team2.reserved_amount == 600.0

    # Admin undoes Team 2's bid
    r_undo = await client.post(f"/api/auctions/{auction_id}/undo-bid", headers=admin_h)
    assert r_undo.status_code == 200
    state = r_undo.json()
    assert state["current_bid"] == 500.0
    assert state["highest_bidder_team_id"] == str(team1.id)

    # Team 2's reservation released, Team 1's reservation restored!
    await db.refresh(team1)
    await db.refresh(team2)
    assert team2.reserved_amount == 0.0
    assert team1.reserved_amount == 500.0

    await check_all_purse_invariants(db)


# ── 8. Security Audit: Captain Cannot Access Admin Endpoints ─────────────────

@pytest.mark.asyncio
async def test_captain_cannot_access_admin_endpoints(
    client: AsyncClient, captain_user: User, tournament: Tournament
):
    """Captain role must be rejected with 403 Forbidden on all admin controls."""
    cap_h = await captain_headers(client, captain_user)

    admin_endpoints = [
        ("POST", f"/api/auctions/fake_id/start"),
        ("POST", f"/api/auctions/fake_id/pause"),
        ("POST", f"/api/auctions/fake_id/resume"),
        ("POST", f"/api/auctions/fake_id/sold"),
        ("POST", f"/api/auctions/fake_id/unsold"),
        ("POST", f"/api/auctions/fake_id/skip"),
        ("POST", f"/api/auctions/fake_id/undo-bid"),
        ("POST", f"/api/auctions/fake_id/admin-bid?amount=1000"),
        ("POST", f"/api/players/"),
        ("DELETE", f"/api/players/fake_id"),
        ("POST", f"/api/teams/"),
        ("DELETE", f"/api/teams/fake_id"),
    ]

    for method, path in admin_endpoints:
        if method == "POST":
            res = await client.post(path, headers=cap_h, json={})
        elif method == "DELETE":
            res = await client.delete(path, headers=cap_h)
        assert res.status_code in (401, 403), f"Captain was able to access {path}! Got {res.status_code}"


# ── 9. Security Audit: File Upload Validation ─────────────────────────────────

@pytest.mark.asyncio
async def test_file_upload_validation(
    client: AsyncClient, admin_user: User, tournament: Tournament
):
    """Reject executable or oversized files, accept valid image extensions."""
    admin_h = await admin_headers(client, admin_user)

    # Create player
    resp = await client.post(
        "/api/players/",
        headers=admin_h,
        json={"tournament_id": tournament.id, "name": "Upload Target", "base_price": 500.0, "auction_order": 1},
    )
    player_id = resp.json()["id"]

    # 1. Attempt to upload a .exe file -> rejected
    bad_file = ("exploit.exe", b"MZ\x90\x00malicious binary content", "application/x-msdownload")
    r_bad = await client.post(
        f"/api/players/{player_id}/photo",
        headers=admin_h,
        files={"file": bad_file},
    )
    assert r_bad.status_code == 400
    assert "INVALID_FILE" in r_bad.text

    # 2. Attempt to upload valid image file -> accepted
    good_file = ("avatar.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00test jpeg data", "image/jpeg")
    r_good = await client.post(
        f"/api/players/{player_id}/photo",
        headers=admin_h,
        files={"file": good_file},
    )
    assert r_good.status_code == 200
    assert "/media/players/" in r_good.json()["photo_url"]


# ── 10. Tournament Day Readiness: Checklist & Reset Tests ───────────────────────

@pytest.mark.asyncio
async def test_tournament_checklist_endpoint(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Checklist endpoint accurately reports status of all 10 diagnostic items."""
    admin_h = await admin_headers(client, admin_user)
    await create_fixture_team(db, tournament.id, "Checklist Team 1", 5000.0)
    await create_fixture_team(db, tournament.id, "Checklist Team 2", 5000.0)

    res = await client.get(f"/api/tournaments/{tournament.id}/checklist", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert "all_ready" in data
    assert "mode" in data
    assert len(data["items"]) == 10
    labels = [i["label"] for i in data["items"]]
    assert "Database connected" in labels
    assert "Redis connected" in labels
    assert "WebSocket connected" in labels
    assert "Admin authenticated" in labels
    assert "Teams configured" in labels
    assert "Players configured" in labels
    assert "Purse configured" in labels
    assert "Auction rules configured" in labels
    assert "All captain accounts active" in labels
    assert "Live screen connected" in labels


@pytest.mark.asyncio
async def test_reset_tournament_protections(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """Accidental reset is blocked in LIVE mode and requires password + confirm phrase."""
    admin_h = await admin_headers(client, admin_user)

    # 1. Wrong admin password -> 401 or 403
    r_bad_pw = await client.post(
        f"/api/tournaments/{tournament.id}/reset",
        headers=admin_h,
        json={"password": "wrongpassword", "mode": "PRACTICE"},
    )
    assert r_bad_pw.status_code in (401, 403)

    # Ensure tournament is in LIVE mode
    await client.patch(f"/api/tournaments/{tournament.id}", headers=admin_h, json={"mode": "LIVE"})

    # 2. In LIVE mode, resetting without confirm phrase -> 400
    r_no_phrase = await client.post(
        f"/api/tournaments/{tournament.id}/reset",
        headers=admin_h,
        json={"password": "adminpass", "mode": "PRACTICE"},
    )
    assert r_no_phrase.status_code == 400
    assert "RESET-LIVE-AUCTION" in r_no_phrase.text

    # 3. With correct confirm phrase -> 200 OK
    r_ok = await client.post(
        f"/api/tournaments/{tournament.id}/reset",
        headers=admin_h,
        json={
            "password": "adminpass",
            "mode": "PRACTICE",
            "confirm_phrase": "RESET-LIVE-AUCTION",
        },
    )
    assert r_ok.status_code == 200
    assert r_ok.json()["success"] is True
    assert r_ok.json()["mode"] == "PRACTICE"


@pytest.mark.asyncio
async def test_completed_auction_and_sold_player_protections(
    client: AsyncClient, admin_user: User, tournament: Tournament, db: AsyncSession
):
    """SOLD players cannot be resold, and COMPLETED auction config cannot be modified."""
    admin_h = await admin_headers(client, admin_user)
    team1, cap1 = await create_fixture_team(db, tournament.id, "Prot Team", 5000.0)

    # Create auction
    r_auc = await client.post(
        "/api/auctions/",
        headers=admin_h,
        json={"tournament_id": tournament.id, "starting_purse": 5000.0, "base_price": 500.0, "bid_increment": 100.0, "timer_seconds": 15},
    )
    auction_id = r_auc.json()["id"]

    # Create player
    r_ply = await client.post(
        "/api/players/",
        headers=admin_h,
        json={"tournament_id": tournament.id, "name": "Protected Star", "base_price": 500.0, "auction_order": 1},
    )
    player_id = r_ply.json()["id"]

    # Start auction & set player
    await client.post(f"/api/auctions/{auction_id}/start", headers=admin_h)
    await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)

    # Place bid & sell
    cap1_h = await captain_headers(client, cap1)
    await client.post(f"/api/auctions/{auction_id}/bid", headers=cap1_h, json={"auction_id": auction_id, "amount": 500.0})
    await client.post(f"/api/auctions/{auction_id}/sold", headers=admin_h)

    # Move auction to READY for next player
    await client.post(f"/api/auctions/{auction_id}/next-player", headers=admin_h)

    # Attempt to set SOLD player to LIVE again -> must fail with PLAYER_ALREADY_SOLD
    r_resell = await client.post(f"/api/auctions/{auction_id}/player/{player_id}", headers=admin_h)
    assert r_resell.status_code == 400
    assert "PLAYER_ALREADY_SOLD" in r_resell.text

    # Complete auction
    await client.post(f"/api/auctions/{auction_id}/complete", headers=admin_h)

    # Attempt to modify config on completed auction -> must fail with 400
    r_mod = await client.patch(
        f"/api/auctions/{auction_id}/config",
        headers=admin_h,
        json={"timer_seconds": 30},
    )
    assert r_mod.status_code == 400


@pytest.mark.asyncio
async def test_admin_user_management(
    client: AsyncClient, admin_user: User, db: AsyncSession
):
    """Admin can list and update captain user accounts."""
    admin_h = await admin_headers(client, admin_user)

    # 1. List users
    r_list = await client.get("/api/auth/users", headers=admin_h)
    assert r_list.status_code == 200
    users = r_list.json()
    assert len(users) >= 1

    # 2. Register captain and update
    r_reg = await client.post(
        "/api/auth/register",
        headers=admin_h,
        json={"username": "captain_mgmt_test", "email": "mgmt_test@flyhigh.internal", "password": "password123", "role": "captain"},
    )
    assert r_reg.status_code == 200
    cap_id = r_reg.json()["id"]

    r_upd = await client.patch(
        f"/api/auth/users/{cap_id}",
        headers=admin_h,
        json={"email": "updated_mgmt@flyhigh.internal"},
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["email"] == "updated_mgmt@flyhigh.internal"

