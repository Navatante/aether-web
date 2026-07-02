#!/usr/bin/env bash
#
# backup.sh — dump de la base de datos leyendo la DSN de /etc/aether-web/env.
#
# Genera /var/backups/aether-web/aether-YYYYmmdd-HHMMSS.dump (formato custom de
# pg_dump, comprimido) y borra los dumps con más de AETHER_BACKUP_RETENTION_DAYS
# días (14 por defecto). Lo invoca a diario aether-backup.timer y update.sh
# antes de aplicar migraciones; también se puede lanzar a mano.
#
# Restaurar (con el servicio parado): ver "Backups" en deploy/README.md.
#
# Requiere `pg_dump` en PATH (paquete postgresql-client).
#
set -euo pipefail

# AETHER_ENV_FILE permite probar el script fuera del servidor (dev/CI).
ENV_FILE="${AETHER_ENV_FILE:-/etc/aether-web/env}"
BACKUP_DIR="${AETHER_BACKUP_DIR:-/var/backups/aether-web}"
RETENTION_DAYS="${AETHER_BACKUP_RETENTION_DAYS:-14}"

log() { printf '\e[1;34m==>\e[0m %s\n' "$*"; }
err() { printf '\e[1;31m!!\e[0m %s\n' "$*" >&2; }

if [[ ! -f "$ENV_FILE" ]]; then
  err "$ENV_FILE no existe. Configura el servicio primero."
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  err "'pg_dump' no está en PATH. Instala postgresql-client."
  exit 1
fi

# Cargar AETHER_DATABASE_URL sin imprimirla.
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${AETHER_DATABASE_URL:-}" ]]; then
  err "AETHER_DATABASE_URL vacía en $ENV_FILE."
  exit 1
fi

install -d -m 0700 "$BACKUP_DIR"

OUT="$BACKUP_DIR/aether-$(date +%Y%m%d-%H%M%S).dump"
log "Volcando base de datos a $OUT"
# Formato custom (-Fc): comprimido y restaurable por tablas con pg_restore.
pg_dump --format=custom --file="$OUT" --dbname="$AETHER_DATABASE_URL"
chmod 0600 "$OUT"

if [[ ! -s "$OUT" ]]; then
  err "El dump quedó vacío: $OUT"
  exit 1
fi

log "Dump OK ($(du -h "$OUT" | cut -f1)). Purgando dumps de más de $RETENTION_DAYS días"
find "$BACKUP_DIR" -maxdepth 1 -name 'aether-*.dump' -type f -mtime +"$RETENTION_DAYS" -delete

log "Backup completado."
