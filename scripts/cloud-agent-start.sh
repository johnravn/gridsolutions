#!/usr/bin/env bash
#
# Cloud Agent environment start script.
#
# Runs on every boot to bring up per-boot runtime state that does not survive
# across VM boots:
#   - the Docker daemon
#   - the local Supabase stack
#   - a fresh, deterministic database (migrations + seed.sql + test users)
#   - .env.local pointing the app at the local Supabase instance
#
# Must be idempotent, tolerate restarts, and return (the long-running Vite dev
# server is started separately as a terminal). The dev server reads .env.local,
# which this script writes before it returns.
set -euo pipefail

cd "$(dirname "$0")/.."

log() { echo "[cloud-agent-start] $*"; }

# --- Docker daemon -----------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  log "starting dockerd"
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
# Allow non-root access to the socket (Supabase CLI shells out to `docker`).
sudo chmod 666 /var/run/docker.sock || true
if ! docker info >/dev/null 2>&1; then
  log "ERROR: Docker daemon did not come up"
  sudo tail -n 40 /tmp/dockerd.log || true
  exit 1
fi
log "Docker is up"

# --- Supabase local stack ----------------------------------------------------
# imgproxy/logflare/vector are excluded (not needed for local dev, matches CI).
if ! supabase status >/dev/null 2>&1; then
  log "starting Supabase stack"
  supabase start -x imgproxy,logflare,vector
else
  log "Supabase already running"
fi

# --- Database: migrations + seed.sql + deterministic test users --------------
log "applying migrations and seed.sql (supabase db reset)"
supabase db reset

eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" \
       VITE_SUPABASE_URL="$API_URL" \
       VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
       SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

log "seeding test users and demo data"
npm run db:seed-test-users

# --- App environment file ----------------------------------------------------
log "writing .env.local"
cat > .env.local <<ENV
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
ENV

log "done — local Supabase API at $API_URL, Studio at ${STUDIO_URL:-http://127.0.0.1:54323}"
log "test login: owner@test.grid.local / TestPassword123!"
