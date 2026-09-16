"""Initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-09-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Tournaments
    op.create_table(
        "tournaments",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sport", sa.String(64), nullable=False, server_default="Badminton"),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("mode", sa.String(32), nullable=False, server_default="LIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 2. Teams
    op.create_table(
        "teams",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("tournament_id", sa.UUID(as_uuid=False), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("logo_url", sa.String(512), nullable=True),
        sa.Column("captain_name", sa.String(128), nullable=True),
        sa.Column("captain_username", sa.String(64), nullable=True),
        sa.Column("total_purse", sa.Float(), nullable=False, server_default="5000.0"),
        sa.Column("spent_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("reserved_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tournament_id", "name", name="uq_team_name_per_tournament"),
    )
    op.create_index("ix_teams_tournament_id", "teams", ["tournament_id"])

    # 3. Users
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="captain"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("team_id", sa.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # 4. Players
    op.create_table(
        "players",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("tournament_id", sa.UUID(as_uuid=False), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("photo_url", sa.String(512), nullable=True),
        sa.Column("gender", sa.String(16), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("age_group", sa.String(32), nullable=True),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("skill_level", sa.String(64), nullable=True),
        sa.Column("base_price", sa.Float(), nullable=False, server_default="500.0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="AVAILABLE"),
        sa.Column("auction_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_players_tournament_status", "players", ["tournament_id", "status"])
    op.create_index("ix_players_auction_order", "players", ["tournament_id", "auction_order"])

    # 5. Auctions
    op.create_table(
        "auctions",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("tournament_id", sa.UUID(as_uuid=False), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("mode", sa.String(32), nullable=False, server_default="LIVE"),
        sa.Column("current_player_id", sa.UUID(as_uuid=False), sa.ForeignKey("players.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_bid", sa.Float(), nullable=True),
        sa.Column("highest_bidder_team_id", sa.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("starting_purse", sa.Float(), nullable=False, server_default="5000.0"),
        sa.Column("base_price", sa.Float(), nullable=False, server_default="500.0"),
        sa.Column("bid_increment", sa.Float(), nullable=False, server_default="100.0"),
        sa.Column("timer_seconds", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("timer_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auctions_tournament_state", "auctions", ["tournament_id", "state"])

    # 6. Bids
    op.create_table(
        "bids",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("auction_id", sa.UUID(as_uuid=False), sa.ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_id", sa.UUID(as_uuid=False), sa.ForeignKey("players.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rejection_reason", sa.String(128), nullable=True),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bids_auction_player", "bids", ["auction_id", "player_id"])
    op.create_index("ix_bids_team", "bids", ["team_id"])
    op.create_index("ix_bids_placed_at", "bids", ["placed_at"])

    # 7. Roster Entries
    op.create_table(
        "roster_entries",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("auction_id", sa.UUID(as_uuid=False), sa.ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_id", sa.UUID(as_uuid=False), sa.ForeignKey("players.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sold_price", sa.Float(), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("auction_id", "player_id", name="uq_roster_player_per_auction"),
    )
    op.create_index("ix_roster_team", "roster_entries", ["team_id"])

    # 8. Auction Events
    op.create_table(
        "auction_events",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("auction_id", sa.UUID(as_uuid=False), sa.ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("actor_user_id", sa.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auction_events_auction", "auction_events", ["auction_id"])
    op.create_index("ix_auction_events_created_at", "auction_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("auction_events")
    op.drop_table("roster_entries")
    op.drop_table("bids")
    op.drop_table("auctions")
    op.drop_table("players")
    op.drop_table("users")
    op.drop_table("teams")
    op.drop_table("tournaments")
