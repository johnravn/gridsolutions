#!/usr/bin/env bash
#
# Cloud Agent environment install script.
#
# Runs once after the repository is checked out (and again when dependencies
# need refreshing). Prepares durable, source-derived state:
#   - Node dependencies (npm ci)
#   - Docker Engine + fuse-overlayfs (needed to run the local Supabase stack
#     inside the nested Cloud Agent VM)
#   - Supabase CLI on the system PATH
#
# Must be idempotent and terminate. Per-boot services (dockerd, Supabase, the
# dev server) are started from cloud-agent-start.sh / terminals, not here.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[cloud-agent-install] installing Node dependencies"
npm ci

echo "[cloud-agent-install] installing Docker + fuse-overlayfs"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
# fuse3 ships an /etc/fuse.conf conffile whose interactive prompt can wedge
# dpkg; force the non-interactive default so the install always completes.
sudo apt-get install -y -qq \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  docker.io fuse-overlayfs uidmap
sudo dpkg --configure -a --force-confdef --force-confold || true

echo "[cloud-agent-install] configuring Docker daemon for the nested VM"
# The VM's root filesystem is already an overlay mount, so Docker's default
# native overlay2 driver cannot mount overlay-on-overlay (fails with
# "invalid argument"). fuse-overlayfs works. Docker 29 also defaults to the
# nftables firewall backend, whose bridge NAT rules do not apply here and
# break container-to-container networking; iptables-legacy works.
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "features": { "containerd-snapshotter": false },
  "storage-driver": "fuse-overlayfs",
  "firewall-backend": "iptables"
}
JSON

sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

# Let the agent user talk to the Docker socket without sudo.
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)" || true

echo "[cloud-agent-install] exposing Supabase CLI on the system PATH"
# The db scripts intentionally call `supabase` from the system PATH (they strip
# node_modules/.bin), so symlink the CLI binary npm installed into /usr/local/bin.
SUPABASE_BIN="$(pwd)/node_modules/@supabase/cli-linux-x64/bin/supabase"
if [ -x "$SUPABASE_BIN" ]; then
  sudo ln -sf "$SUPABASE_BIN" /usr/local/bin/supabase
else
  echo "[cloud-agent-install] WARNING: supabase CLI binary not found at $SUPABASE_BIN" >&2
fi

echo "[cloud-agent-install] done"
