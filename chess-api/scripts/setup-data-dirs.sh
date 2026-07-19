#!/usr/bin/env bash
# Usage: sudo bash scripts/setup-data-dirs.sh /mnt/data
#
# Creates and fixes permissions for all data directories used by chess-api.
# Run this before starting the container, especially on LXC/Docker with
# bind mounts where permissions are tricky.
set -euo pipefail

DATA_DIR="${1:-}"
if [[ -z "$DATA_DIR" ]]; then
  cat <<EOF
Usage: sudo bash scripts/setup-data-dirs.sh <path>

Examples:
  sudo bash scripts/setup-data-dirs.sh /mnt/data
  sudo bash scripts/setup-data-dirs.sh /mnt/data/chessproject/data
  sudo bash scripts/setup-data-dirs.sh /app/data
EOF
  exit 1
fi

echo "Creating data directories under: $DATA_DIR"
mkdir -p "$DATA_DIR"/{avatars,logs,backups}
chmod 755 "$DATA_DIR"

# Detect LXC UID mapping (default offset 100000)
# Root in container (UID 0) maps to UID 100000 on host
# chess user in container (UID 1000) maps to UID 101000 on host
# If unsure, run 'id' inside the container to see the UID
LXC_OFFSET="${LXC_OFFSET:-100000}"
CONTAINER_UID="${CONTAINER_UID:-0}"

if [[ "$CONTAINER_UID" == "auto" ]]; then
  # Heuristic: if /etc/subuid exists, parse it
  if [[ -f /etc/subuid ]]; then
    LXC_OFFSET=$(grep root /etc/subuid 2>/dev/null | cut -d: -f2 || echo "100000")
  fi
  CONTAINER_UID=0
fi

HOST_UID=$((CONTAINER_UID + LXC_OFFSET))

echo "Setting ownership to UID $HOST_UID (container UID $CONTAINER_UID + offset $LXC_OFFSET)"
if chown -R "$HOST_UID:$HOST_UID" "$DATA_DIR" 2>/dev/null; then
  echo "Ownership set successfully."
else
  echo "chown failed (common on NFS/ZFS/unprivileged LXC). Falling back to chmod 777..."
  chmod -R 777 "$DATA_DIR"
fi

echo "Done. Directories created:"
ls -la "$DATA_DIR"/
