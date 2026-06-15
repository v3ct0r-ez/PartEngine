#!/usr/bin/env sh
# PartEngine self-update script (notify + one-click apply model).
#
# Invoked detached by the API's UpdateService when a SUPER_ADMIN clicks
# "Aggiorna ora". It is intentionally conservative: back up first, migrate
# inside a one-shot container, then recreate services. Logs to infra/update.log.
#
# Env (passed through by the API; sensible defaults here):
#   COMPOSE_FILE        path to docker-compose.yml (default: ./docker-compose.yml)
#   TARGET_VERSION      tag being moved to (informational, set by the API)
#   BACKUP_DIR          where pg_dump output goes (default: ./backups)
set -eu

cd "$(dirname "$0")"
COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG="./update.log"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== PartEngine update -> ${TARGET_VERSION:-latest} ==="

# 1) Safety backup (PITR also covers this in prod; this is the belt-and-braces dump).
mkdir -p "$BACKUP_DIR"
log "Backing up database..."
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U partengine partengine | gzip > "$BACKUP_DIR/partengine-$TS.sql.gz" \
  && log "Backup written to $BACKUP_DIR/partengine-$TS.sql.gz" \
  || { log "WARNING: backup failed — aborting update"; exit 1; }

# 2) Pull the new images for the target tag.
log "Pulling new images..."
docker compose -f "$COMPOSE_FILE" pull

# 3) Run database migrations in a disposable container (no app traffic yet).
log "Applying migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api sh -c \
  "pnpm prisma:migrate && psql \"\$DATABASE_URL\" -f prisma/sql/001_search.sql" \
  || { log "ERROR: migration failed — services NOT recreated. Restore from $BACKUP_DIR if needed."; exit 1; }

# 4) Recreate services with the new images.
log "Recreating services..."
docker compose -f "$COMPOSE_FILE" up -d

log "=== Update complete: now on ${TARGET_VERSION:-latest} ==="
