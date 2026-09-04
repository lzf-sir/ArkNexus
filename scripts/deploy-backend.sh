#!/usr/bin/env bash
# Deploy the ArkNexus backend stack to a remote Linux host.
#
# This script:
#   1. Pulls the latest source from the local working copy (assumes git).
#   2. rsync's it to $REMOTE_HOST (configurable).
#   3. On the remote, builds the 4 Docker images and brings up the stack
#      via docker-compose.
#
# Prerequisites on the remote host:
#   * docker + docker compose plugin installed
#   * A non-root user with passwordless sudo for `docker compose`
#   * /etc/cloudflared/<TUNNEL-UUID>.json present + CLOUDFLARE_TUNNEL_TOKEN set
#
# Usage:
#   REMOTE_HOST=arknexus@example.com \
#   REMOTE_DIR=/opt/arknexus \
#   ./scripts/deploy-backend.sh

set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE_HOST="${REMOTE_HOST:?REMOTE_HOST is required (e.g. arknexus@example.com)}"
REMOTE_DIR="${REMOTE_DIR:-/opt/arknexus}"

echo "==> Syncing source to ${REMOTE_HOST}:${REMOTE_DIR}"
rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.venv' \
    --exclude '*.pyc' \
    --exclude '__pycache__' \
    --exclude 'data' \
    --exclude 'dist' \
    --exclude '.workbuddy' \
    ./ "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> Building + restarting on ${REMOTE_HOST}"
ssh "${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd ${REMOTE_DIR}

# Copy the production env if missing (one-time bootstrap).
if [ ! -f deploy/.env.production ]; then
    echo "deploy/.env.production missing on remote. Refusing to start."
    echo "Copy deploy/.env.production.example to deploy/.env.production and fill it in."
    exit 1
fi

docker compose -f deploy/docker-compose.production.yml \
    --env-file deploy/.env.production \
    build

docker compose -f deploy/docker-compose.production.yml \
    --env-file deploy/.env.production \
    up -d --remove-orphans

# Wait for the gateway to become healthy.
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
        echo "Gateway healthy after \${i}s"
        exit 0
    fi
    sleep 2
done

echo "Gateway failed to become healthy within 20s. Check 'docker compose logs gateway'."
exit 1
EOF

cat <<EOF

✅ Backend deployed to ${REMOTE_HOST}.

Verify:
  curl -fsS https://api.example.com/health
  docker compose -f deploy/docker-compose.production.yml \\
      --env-file deploy/.env.production ps
EOF
