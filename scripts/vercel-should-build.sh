#!/usr/bin/env bash
# Vercel Ignored Build Step / vercel.json "ignoreCommand".
# Exit 0 = skip this deployment; exit 1 = continue building.
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# Production (main) strategy: only build when APP_VERSION changed.
# - Feature merge without a version bump → skip (bump bot will push next)
# - Bot commit "chore: bump APP_VERSION to x.y.z" → build (one deploy)
# - Ship that already bumped APP_VERSION in the merge → build; bot no-ops
# Preview branches always build.
set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-}"
VERSION_FILE="src/app/config/releaseNotes.ts"

if [[ "$REF" != "main" ]]; then
  echo "vercel-should-build: ref=${REF:-unknown} (not main) → build"
  exit 1
fi

MSG="$(git log -1 --pretty=%B 2>/dev/null || true)"
if echo "$MSG" | grep -qE '^chore: bump APP_VERSION to '; then
  echo "vercel-should-build: version bump bot commit → build"
  exit 1
fi

if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "vercel-should-build: no parent commit → build"
  exit 1
fi

# First parent for merges; ordinary parent for squash/rebase commits.
if git diff -G "export const APP_VERSION" HEAD^ HEAD -- "$VERSION_FILE" | grep -q .; then
  echo "vercel-should-build: APP_VERSION changed → build"
  exit 1
fi

echo "vercel-should-build: main push without APP_VERSION change → skip (await bump bot)"
exit 0
