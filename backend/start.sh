#!/bin/sh
# ============================================================
# FlyHigh Auction Backend — Production Startup Script
# ============================================================
# 1. Run database migrations
# 2. Start gunicorn with uvicorn workers serving the Socket.IO ASGI app

set -e

echo "🔄 Running database migrations..."
python -m alembic upgrade head

echo "🚀 Starting FlyHigh Auction API..."
exec gunicorn app.main:socket_app \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers ${WEB_CONCURRENCY:-2} \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile -
