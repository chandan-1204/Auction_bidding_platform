# 🏸 FlyHigh Team Event — Live Auction Platform

> **A production-ready, authoritative, real-time sports player auction system built for high-stakes tournaments, auditoriums, mobile captains, and large-screen TV telecasts.**

---

## 🌟 Overview

**FlyHigh Team Event — Live Auction** is a full-stack, enterprise-grade auction platform designed specifically for sports tournaments (e.g., Badminton, Cricket, Football).

The platform eliminates the chaos of manual auctions with:
* ⚡ **Sub-100ms Real-Time Bid Synchronization** powered by WebSockets / Socket.IO
* 🔒 **Authoritative Backend State Engine** using PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions
* 💰 **Triple-Purse Financial Accounting** (`Total Purse = Spent + Reserved + Available`)
* ⏱️ **Server-Authoritative Countdown Timers** immune to client-clock manipulation
* 📱 **Mobile-First Captain Cockpit** featuring one-tap bidding, fast increments, and purse alerts
* 🎛️ **Auctioneer Command Center** with full playback controls (Pause, Resume, Undo, Sold, Unsold, Next)
* 📺 **Stage / TV Hall Projector Display (`/live`)** featuring stadium typography, live purse ribbons, and celebratory hammer-down animations
* 📊 **CSV Bulk Import & Export** for player rosters and final tournament results

---

## 🏗️ Architecture & Technology Stack

```
                                 ┌─────────────────────────┐
                                 │   Browser / TV / Mobile │
                                 │   React 19 + TypeScript │
                                 │   Tailwind CSS + Vite   │
                                 └────────────┬────────────┘
                                              │
                       REST (Axios)           │ Socket.IO (ASGI)
                                              ▼
                                 ┌─────────────────────────┐
                                 │   FastAPI + Uvicorn     │
                                 │   Python-SocketIO Server│
                                 └────────────┬────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       ┌─────────────────────────┐                         ┌─────────────────────────┐
       │   PostgreSQL 15         │                         │   Redis 7               │
       │   (ACID State Engine,   │                         │   (Distributed Locks &  │
       │    Row Locks, Alembic)  │                         │    Real-Time Pub/Sub)   │
       └─────────────────────────┘                         └─────────────────────────┘
```

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query v5, Socket.IO Client, Lucide Icons, react-hot-toast |
| **Backend** | Python 3.11, FastAPI, Python-SocketIO, SQLAlchemy 2.0 (Async), Pydantic v2, Uvicorn (ASGI) |
| **Database & Migrations**| PostgreSQL 15, Alembic, asyncpg, psycopg2 |
| **Caching & Pub/Sub** | Redis 7 |
| **DevOps & Containerization** | Docker, Docker Compose, Multi-stage builds |

---

## 🚀 Quickstart with Docker Compose

The fastest way to spin up the entire production-grade stack is with Docker Compose:

### 1. Clone & Setup Environment
```bash
git clone https://github.com/chandan-1204/Auction_bidding_platform.git
cd Auction_bidding_platform
cp .env.example .env
```

### 2. Start Services
```bash
docker compose up --build
```

This will automatically:
1. Start PostgreSQL 15 and Redis 7
2. Wait for database and Redis health checks
3. Run Alembic database migrations (`alembic upgrade head`)
4. Seed demo tournament, 3 teams, 3 captain users, and 8 players (`python -m app.scripts.seed`)
5. Launch FastAPI + Socket.IO server on `http://localhost:8000`
6. Launch Vite React Frontend on `http://localhost:5173`

---

## 🔑 Demo Accounts & Credentials

The seed script automatically populates the following accounts:

| Role | Username | Password | Purpose |
|---|---|---|---|
| **Administrator / Auctioneer** | `admin` | `admin123` | Full control: start auction, pause, resume, sold, unsold, edit players/teams |
| **Team Captain (Team Blaze)** | `blaze_captain` | `blaze123` | Captain bidding portal (₹5,000 Purse) |
| **Team Captain (Net Masters)** | `netmasters_captain` | `netmasters123` | Captain bidding portal (₹5,000 Purse) |
| **Team Captain (Court Commandos)** | `commandos_captain` | `commandos123` | Captain bidding portal (₹5,000 Purse) |

---

## 🖥️ Screen Routes & Capabilities

### 1. Public Big-Screen Projector Telecast (`/live`)
* Public URL intended for display on high-definition stage projectors or large 4K TVs in the hall.
* Full-screen stadium mode with real-time countdown ring.
* Massive bid spotlight visible across large auditoriums.
* Live team purse ticker showing spent and remaining balances across all teams.
* Dramatic celebratory overlays on **SOLD** and **UNSOLD**.

### 2. Captain Mobile Cockpit (`/captain`)
* Optimized for mobile smartphones and tablets.
* **Large Fixed One-Tap BID Button** that computes the next valid minimum bid.
* Quick preset increment buttons (`+₹100`, `+₹200`, `+₹500`).
* Real-time purse breakdown with warnings when funds are low or insufficient.
* Live status indicators: "YOU ARE HIGHEST BIDDER" vs "OUTBID".

### 3. Admin & Auctioneer Command Center (`/admin/auction`)
* Live auction state engine management: `READY` ➔ `LIVE` ➔ `PAUSED` ➔ `SOLD` / `UNSOLD` ➔ `NEXT`.
* Manual bid placement or fast undo of erroneous bids.
* Real-time player queue and instant next-player selection.
* Live team purse monitoring and team bid audit history.

### 4. Tournament & Player Management (`/admin/players` & `/admin/teams`)
* Player registration with photo upload, age category, base price, and skill level.
* CSV bulk import and export of players.
* Team creation, captain assignment, and total purse adjustment.

### 5. Audit Trail & Results (`/admin/history` & `/admin/results`)
* Timestamped bid log tracking every bid attempt and validation outcome.
* Final squad breakdown per team with total spend and average player cost.
* One-click CSV export of tournament auction rosters.

---

## 🛠️ Manual Local Development Setup

If you prefer running services directly on your host machine without Docker:

### Prerequisites
* Python 3.11+
* Node.js 20+ & npm
* PostgreSQL running locally on port 5432
* Redis running locally on port 6379

---

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -e ".[dev]"
pip install psycopg2-binary aiosqlite

# Run database migrations
alembic upgrade head

# Seed initial tournament data
python -m app.scripts.seed

# Run the ASGI application with Socket.IO
uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
```

Backend API Swagger Docs: `http://localhost:8000/docs`  
Health Check: `http://localhost:8000/health`

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server with HMR
npm run dev

# Build for production
npm run build
```

Frontend application will be accessible at: `http://localhost:5173`

---

## 🧪 Automated Testing

The backend includes a comprehensive suite of automated tests for authentication, team purse validation, player management, and live auction state transitions.

```bash
cd backend
pytest tests/ -v
```

### Test Coverage Highlights:
* `test_auth.py`: JWT generation, invalid credentials, protected route access control.
* `test_teams_players.py`: Team purse checks, player creation, CSV export formatting.
* `test_auction.py`: Row-locked bid processing, outbidding, purse reservation, insufficient funds rejection, auction state transitions.

---

## 📐 Purse Rules & Invariant Validation

The backend guarantees financial integrity at all times:

1. **Purse Equation**:
   $$\text{Available Purse} = \text{Total Purse} - \text{Spent Amount} - \text{Reserved Amount}$$
2. **Bid Validation**:
   * A team cannot bid if $\text{Bid Amount} > \text{Available Purse} + \text{Previously Reserved Amount (by that same team)}$.
   * A team cannot outbid itself consecutively.
   * Bid amount must be $\ge \text{Current Highest Bid} + \text{Bid Increment}$.
3. **Purse Reservation**:
   * Placing the highest bid temporarily locks the bid amount into `reserved_amount`.
   * When outbid by another team, the previous team's reservation is immediately released.
   * When a player is marked **SOLD**, the reservation is converted to `spent_amount` and the player is assigned to the team's roster.
   * When an undo action is triggered or player is marked **UNSOLD**, the reservation is refunded.

---

## 📄 License

MIT License — free for sports clubs, corporate events, and tournaments.