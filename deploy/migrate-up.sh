#!/usr/bin/env bash
#
# migrate-up.sh — aplica migraciones pendientes leyendo la DSN de /etc/aether-web/env.
#
# Requiere el binario `migrate` (golang-migrate) en PATH.
#   Instalación rápida en Debian/Ubuntu:
#     curl -L https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz \
#       | tar xz -C /usr/local/bin migrate
#
set -euo pipefail

INSTALL_DIR=/opt/aether-web
ENV_FILE=/etc/aether-web/env
MIGRATIONS_DIR=$INSTALL_DIR/migrations

if [[ ! -f "$ENV_FILE" ]]; then
  echo "!! $ENV_FILE no existe. Configura el servicio primero." >&2
  exit 1
fi
if ! command -v migrate >/dev/null 2>&1; then
  echo "!! 'migrate' no está en PATH. Instala golang-migrate (ver README)." >&2
  exit 1
fi

# Cargar AETHER_DATABASE_URL sin imprimirla.
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${AETHER_DATABASE_URL:-}" ]]; then
  echo "!! AETHER_DATABASE_URL vacía en $ENV_FILE." >&2
  exit 1
fi

migrate -path "$MIGRATIONS_DIR" -database "$AETHER_DATABASE_URL" up

# Validación post-migración: si una migración falló a medias, golang-migrate
# deja la versión marcada como "dirty" y el esquema queda inconsistente.
# Mejor abortar aquí (update.sh ni siquiera arrancará el binario nuevo) que
# descubrirlo con errores SQL en producción. Recuperación: restaurar el dump
# pre-migración (ver "Backups" en README) o `migrate ... force <version>`
# tras arreglar a mano.
VERSION_OUT=$(migrate -path "$MIGRATIONS_DIR" -database "$AETHER_DATABASE_URL" version 2>&1)
if echo "$VERSION_OUT" | grep -qi dirty; then
  echo "!! Esquema en estado dirty tras migrar: $VERSION_OUT" >&2
  exit 1
fi
echo "==> Esquema OK en versión: $VERSION_OUT"
