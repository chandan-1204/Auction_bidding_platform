# ============================================================
# FlyHigh Auction Backend — Production Dockerfile
# ============================================================
# Multi-stage build for smaller, more secure production image

# ── Stage 1: Build ──────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .
RUN pip install --no-cache-dir --prefix=/install \
    gunicorn \
    psycopg2-binary

COPY . .

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r flyhigh && useradd -r -g flyhigh -d /app -s /sbin/nologin flyhigh

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create media directory
RUN mkdir -p media/players media/teams && chown -R flyhigh:flyhigh media

# Copy and set up startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Switch to non-root user
USER flyhigh

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start with the Socket.IO ASGI app via gunicorn + uvicorn workers
CMD ["/app/start.sh"]
