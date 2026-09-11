#!/usr/bin/env bash
# Builds the image, starts Jellyfin + jellycrew from docker-compose.ci.yml, bootstraps
# Jellyfin (wizard + API key), and asserts that the jellycrew container becomes healthy
# and that /healthz reports Jellyfin as reachable. Exit code 0 = pass.
set -euo pipefail
cd "$(dirname "$0")/.."
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose -f docker-compose.ci.yml"
else
  COMPOSE="docker-compose -f docker-compose.ci.yml"
fi
cleanup() { $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

export JELLYFIN_API_KEY=placeholder
$COMPOSE up -d jellyfin
echo "bootstrapping Jellyfin..."
JELLYFIN_API_KEY="$(pnpm exec tsx scripts/bootstrap-jellyfin.ts http://localhost:28096 | tail -1)"
export JELLYFIN_API_KEY
echo "building and starting jellycrew..."
$COMPOSE up -d --build --wait --wait-timeout 180 jellycrew

CID="$($COMPOSE ps -q jellycrew)"
STATUS="$(docker inspect --format '{{.State.Health.Status}}' "$CID")"
echo "container health: $STATUS"
[ "$STATUS" = "healthy" ] || { docker logs "$CID" | tail -50; exit 1; }

BODY="$(curl -fsS http://localhost:23000/healthz)"
echo "healthz: $BODY"
echo "$BODY" | grep -q '"status":"ok"' || { echo "healthz status is not ok"; exit 1; }
echo "$BODY" | grep -q '"reachable":true' || { echo "Jellyfin not reachable from the container"; exit 1; }
echo "$BODY" | grep -q '"version":"10.11.11"' || { echo "unexpected Jellyfin version"; exit 1; }
USER_ID="$(docker exec "$CID" id -u)"
[ "$USER_ID" != "0" ] || { echo "container runs as root"; exit 1; }
echo "compose check passed (uid $USER_ID)"
