# 🚀 FlyHigh Live Auction — Production Deployment Guide

> **Difficulty**: Beginner-friendly  
> **Time required**: ~30 minutes  
> **Cost**: Free tier on all services

This guide walks you through deploying the FlyHigh Team Event Live Auction platform from zero to production using free tiers of Vercel, Render, Neon, and Upstash.

---

## Architecture Overview

```
┌─────────────┐     HTTPS      ┌──────────────┐     PostgreSQL     ┌─────────┐
│   Vercel     │◄──────────────►│   Render      │◄─────────────────►│  Neon   │
│  (Frontend)  │   REST + WS   │  (Backend)    │                    │  (DB)   │
│  React/Vite  │               │  FastAPI +    │     Redis/TLS      ┌─────────┐
│              │               │  Socket.IO    │◄─────────────────►│ Upstash │
└─────────────┘               └──────────────┘                    └─────────┘
```

---

## Step 1: Push Code to GitHub

1. **Create a GitHub repository**:
   - Go to [github.com/new](https://github.com/new)
   - Name: `Auction_bidding_platform` (or your choice)
   - Set to **Private** (recommended — it contains your app code)
   - Click **Create repository**

2. **Push your code**:
   ```bash
   cd d:\Chandan_repos\Auction_bidding_platform
   git init
   git add .
   git commit -m "Prepare for production deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/Auction_bidding_platform.git
   git push -u origin main
   ```

> [!IMPORTANT]
> The `.gitignore` is configured to exclude `.env` files. Your database credentials and secrets will NOT be pushed to GitHub. Verify with `git status` before pushing.

---

## Step 2: Create Neon PostgreSQL Database

1. **Sign up** at [neon.tech](https://neon.tech) (free tier: 0.5GB storage)

2. **Create a new project**:
   - Name: `flyhigh-auction`
   - Region: Choose the closest to your users (e.g., `US East`)
   - Click **Create Project**

3. **Copy the connection string**:
   - Go to **Dashboard → Connection Details**
   - Select **Connection string** format
   - Copy the string — it looks like:
     ```
     postgresql://neondb_owner:xxxx@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - **Save this** — you'll need it for Render

> [!TIP]
> Neon uses connection pooling by default. The connection string from the dashboard already includes the pooler endpoint, which is what you want for production.

---

## Step 3: Create Upstash Redis

1. **Sign up** at [upstash.com](https://upstash.com) (free tier: 10,000 commands/day)

2. **Create a new Redis database**:
   - Name: `flyhigh-auction`
   - Region: Same as your Neon database
   - Enable **TLS (SSL)** ← This is default
   - Click **Create**

3. **Copy the connection URL**:
   - Go to the database details page
   - Find **Redis Connect** → select `redis-cli` or `ioredis`
   - Copy the `rediss://` URL — it looks like:
     ```
     rediss://default:AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ@us1-xxxxx.upstash.io:6379
     ```
   - **Save this** — you'll need it for Render

> [!IMPORTANT]
> Notice the URL starts with `rediss://` (double 's') — this means TLS is enabled. The app handles this automatically.

---

## Step 4: Deploy Backend on Render

1. **Sign up** at [render.com](https://render.com) (free tier available)

2. **Create a new Web Service**:
   - Click **New** → **Web Service**
   - Connect your GitHub account and select the `Auction_bidding_platform` repository
   - **Name**: `flyhigh-auction-api`
   - **Region**: Same as Neon/Upstash
   - **Root Directory**: `backend`
   - **Runtime**: **Docker**
   - **Instance Type**: Free

3. **Set Environment Variables**:
   
   In the Render dashboard, go to **Environment** and add these variables:

   | Variable | Value |
   |----------|-------|
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | *(paste your Neon connection string from Step 2)* |
   | `REDIS_URL` | *(paste your Upstash Redis URL from Step 3)* |
   | `JWT_SECRET` | *(click "Generate" for a secure random value)* |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` *(update after Vercel deploy)* |
   | `FRONTEND_URL` | `https://your-app.vercel.app` *(update after Vercel deploy)* |
   | `ADMIN_EMAIL` | `admin@flyhigh.com` |
   | `ADMIN_PASSWORD` | *(choose a strong password!)* |
   | `ADMIN_USERNAME` | `admin` |
   | `WEB_CONCURRENCY` | `2` |

4. **Deploy**: Click **Create Web Service**
   - Render will build the Docker image and start the service
   - Wait for the deploy to complete (3–5 minutes on first deploy)
   - Your API URL will be something like: `https://flyhigh-auction-api.onrender.com`

5. **Verify**: Open `https://flyhigh-auction-api.onrender.com/health` in your browser
   - You should see: `{"status": "ok", "service": "flyhigh-auction-api", ...}`

> [!TIP]
> Render's free tier spins down after 15 minutes of inactivity. First requests after a cold start take ~30 seconds. Upgrade to the Starter plan ($7/month) to avoid this.

---

## Step 5: Deploy Frontend on Vercel

1. **Sign up** at [vercel.com](https://vercel.com)

2. **Import your project**:
   - Click **Add New** → **Project**
   - Connect GitHub and select the `Auction_bidding_platform` repository
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

3. **Set Environment Variables**:
   
   In the Vercel project settings → **Environment Variables**, add:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://flyhigh-auction-api.onrender.com` *(your Render URL)* |
   | `VITE_SOCKET_URL` | `https://flyhigh-auction-api.onrender.com` *(same as API URL)* |

4. **Deploy**: Click **Deploy**
   - Vercel will build and deploy the frontend
   - Your frontend URL will be something like: `https://your-app.vercel.app`

5. **Note your Vercel URL** — you need it for the next step!

---

## Step 6: Update CORS on Render

Now that you have your Vercel URL, go back to Render and update:

1. Go to your Render service → **Environment**
2. Update these variables:
   - `CORS_ORIGINS` → `https://your-app.vercel.app`
   - `FRONTEND_URL` → `https://your-app.vercel.app`
3. Click **Save Changes** — Render will auto-redeploy

> [!WARNING]
> If you skip this step, the frontend will get CORS errors when trying to talk to the backend!

---

## Step 7: Create Admin Account

The database migrations run automatically on Render deploy. To seed the admin user:

1. Go to Render → your service → **Shell** tab
2. Run:
   ```bash
   python -m app.scripts.seed
   ```
3. This creates the admin user with the credentials from your environment variables.

---

## Step 8: Verify Everything Works

1. **Health check**: Visit `https://your-api.onrender.com/health`
   - Should show `status: ok`, `database: ok`, `redis: ok`

2. **Frontend**: Visit `https://your-app.vercel.app`
   - Should show the login page

3. **Login**: Use the admin credentials you set in Step 4

4. **WebSocket**: Check the connection indicator in the admin dashboard
   - Should show "LIVE CONNECTED" with a green dot

5. **Create an auction** and test bidding to verify real-time updates

---

## Step 9: Custom Domain (Optional)

### Frontend (Vercel):
1. Go to Vercel → your project → **Settings → Domains**
2. Add your domain (e.g., `auction.flyhigh.com`)
3. Follow Vercel's DNS instructions (add CNAME record)
4. **Update** Render's `CORS_ORIGINS` and `FRONTEND_URL` to include the new domain:
   ```
   CORS_ORIGINS=https://auction.flyhigh.com,https://your-app.vercel.app
   FRONTEND_URL=https://auction.flyhigh.com
   ```

### Backend (Render):
1. Go to Render → your service → **Settings → Custom Domains**
2. Add your domain (e.g., `api.flyhigh.com`)
3. Follow Render's DNS instructions
4. **Update** Vercel's env vars:
   ```
   VITE_API_URL=https://api.flyhigh.com
   VITE_SOCKET_URL=https://api.flyhigh.com
   ```
5. **Redeploy** the Vercel frontend to pick up the new env vars

---

## Environment Variables — Quick Reference

### Backend (Render Dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENV` | ✅ | Set to `production` |
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `REDIS_URL` | ✅ | Upstash Redis URL (starts with `rediss://`) |
| `JWT_SECRET` | ✅ | Secret key for JWT tokens (generate a random string) |
| `CORS_ORIGINS` | ✅ | Vercel frontend URL(s), comma-separated |
| `FRONTEND_URL` | ✅ | Primary frontend URL |
| `ADMIN_EMAIL` | ✅ | Admin account email |
| `ADMIN_PASSWORD` | ✅ | Admin account password (strong!) |
| `ADMIN_USERNAME` | ✅ | Admin account username |
| `WEB_CONCURRENCY` | ❌ | Number of server workers (default: 2) |

### Frontend (Vercel Dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Full Render backend URL |
| `VITE_SOCKET_URL` | ✅ | Same as `VITE_API_URL` |

---

## WebSocket Configuration Notes

- Socket.IO connects from the frontend (`VITE_SOCKET_URL`) to the backend
- The backend uses the **ASGI** Socket.IO wrapper (`socket_app`), not the plain FastAPI `app`
- Both REST and WebSocket traffic go through the same Render URL on port 443 (HTTPS)
- Socket.IO is configured with both `websocket` and `polling` transports for reliability
- CORS for Socket.IO uses the same origin list as the REST API

---

## CORS Configuration Notes

- CORS is configured in **two places** on the backend:
  1. FastAPI `CORSMiddleware` (for REST API requests)
  2. Socket.IO `cors_allowed_origins` (for WebSocket handshake)
- Both use the same `settings.allowed_origins_list` — set `CORS_ORIGINS` once and both are covered
- `FRONTEND_URL` is automatically added to the CORS list if set

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| CORS errors in browser console | Update `CORS_ORIGINS` and `FRONTEND_URL` on Render to match your exact Vercel URL (include `https://`, no trailing slash) |
| WebSocket won't connect | Same as CORS — also check that `VITE_SOCKET_URL` in Vercel matches the Render URL |
| "502 Bad Gateway" on Render | Check Render logs — usually means the app crashed on startup. Verify `DATABASE_URL` and `REDIS_URL` |
| Login doesn't work | Run `python -m app.scripts.seed` in the Render shell to create the admin user |
| Slow first load | Render free tier cold starts. Wait 30s or upgrade to Starter plan |
| Database connection errors | Verify Neon connection string. Make sure it starts with `postgresql://` (the app auto-converts) |
| Redis connection errors | Verify Upstash URL starts with `rediss://` (double 's' for TLS) |
| Frontend shows blank page | Check browser console for errors. Verify `VITE_API_URL` is set correctly in Vercel |

---

## Security Checklist

- [ ] `.env` files are in `.gitignore` (no secrets in git)
- [ ] `JWT_SECRET` is a strong random string (not the default)
- [ ] `ADMIN_PASSWORD` is not `admin123`
- [ ] `APP_ENV` is set to `production` on Render
- [ ] CORS only allows your specific domain(s)
- [ ] Neon database uses SSL (`sslmode=require`)
- [ ] Upstash Redis uses TLS (`rediss://`)
- [ ] GitHub repository is private
