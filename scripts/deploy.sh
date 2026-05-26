#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
SERVICE_NAME="${SERVICE_NAME:-app}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.production.example and fill production values first." >&2
  exit 1
fi

if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  git pull --ff-only
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build "$SERVICE_NAME"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm "$SERVICE_NAME" npx prisma migrate deploy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
