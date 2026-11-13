#!/usr/bin/env bash
#
# Cloud Agent environment start script.
#
# Prefer hosted Supabase Dev when Cursor/cloud secrets are present.
# Fall back to local Docker Supabase when they are not.
#
# Must be idempotent and return (Vite is started separately as a terminal).
set -euo pipefail

cd "$(dirname "$0")/.."

log() { echo "[cloud-agent-start] $*"; }

PROD_REF="tlpgejkglrgoljgvpubn"

write_env_local() {
  local url="$1"
  local anon="$2"
  local ref="$3"
  log "writing .env.local"
  {
    echo "VITE_SUPABASE_URL=${url}"
    echo "VITE_SUPABASE_ANON_KEY=${anon}"
    echo "SUPABASE_PROJECT_REF=${ref}"
    if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
      echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
    fi
  } > .env.local
}

# --- Hosted Dev (preferred) --------------------------------------------------
# Set these as Cursor Project / cloud environment secrets (Dev project only).
# Never inject Prod service_role into agent VMs by default.
if [[ "${SUPABASE_USE_DOCKER:-}" != "1" \
   && -n "${VITE_SUPABASE_URL:-}" \
   && "${VITE_SUPABASE_URL}" == *".supabase.co"* \
   && -n "${VITE_SUPABASE_ANON_KEY:-}" ]]; then

  REF="${SUPABASE_PROJECT_REF:-}"
  if [[ -z "$REF" ]]; then
    # Derive ref from https://<ref>.supabase.co
    REF="$(printf '%s' "$VITE_SUPABASE_URL" | sed -n 's#https://\([^.]*\)\.supabase\.co.*#\1#p')"
  fi

  if [[ "$REF" == "$PROD_REF" ]]; then
    log "ERROR: secrets point at Prod (${PROD_REF}). Cloud agents must use Dev only."
    log "Fix Cursor Project secrets to the Dev project, or set SUPABASE_USE_DOCKER=1 for local Docker."
    exit 1
  fi

  if [[ -z "$REF" || "$REF" == *"YOUR_"* ]]; then
    log "ERROR: SUPABASE_PROJECT_REF missing or placeholder while using hosted URL."
    exit 1
  fi

  log "using hosted Dev (${REF}) — skipping local Docker Supabase"
  write_env_local "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY" "$REF"

  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && "${SUPABASE_SEED_DEV:-}" == "1" ]]; then
    log "seeding test users on Dev (SUPABASE_SEED_DEV=1)"
    export SUPABASE_URL="$VITE_SUPABASE_URL"
    export VITE_SUPABASE_URL
    export VITE_SUPABASE_ANON_KEY
    export SUPABASE_SERVICE_ROLE_KEY
    npm run db:seed-test-users || log "WARNING: db:seed-test-users failed (Dev may already be seeded)"
  else
    log "skipping seed (set SUPABASE_SEED_DEV=1 with service role to seed Dev on boot)"
  fi

  log "done — app points at hosted Dev ${VITE_SUPABASE_URL}"
  log "test login (after seed): owner@test.grid.local / TestPassword123!"
  exit 0
fi

# --- Docker fallback ---------------------------------------------------------
log "hosted Dev secrets not set — starting local Docker Supabase"
log "(set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + SUPABASE_PROJECT_REF for Dev)"

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
sudo chmod 666 /var/run/docker.sock || true
if ! docker info >/dev/null 2>&1; then
  log "ERROR: Docker daemon did not come up"
  sudo tail -n 40 /tmp/dockerd.log || true
  exit 1
fi
log "Docker is up"

if ! supabase status >/dev/null 2>&1; then
  log "starting Supabase stack"
  supabase start -x imgproxy,logflare,vector
else
  log "Supabase already running"
fi

log "applying migrations and seed.sql (supabase db reset)"
supabase db reset

eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" \
       VITE_SUPABASE_URL="$API_URL" \
       VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
       SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

log "seeding test users and demo data"
npm run db:seed-test-users

write_env_local "$API_URL" "$ANON_KEY" "local"

log "done — local Supabase API at $API_URL, Studio at ${STUDIO_URL:-http://127.0.0.1:54323}"
log "test login: owner@test.grid.local / TestPassword123!"
