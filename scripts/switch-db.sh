#!/bin/bash
# Thin wrapper — prefer: npm run db:switch:{local|dev|prod|status}
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/switch-db.js "$@"
