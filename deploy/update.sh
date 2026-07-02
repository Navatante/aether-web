#!/usr/bin/env bash
#
# update.sh — actualización in-place de aether-web ya instalado.
#
# Hace, en este orden:
#   1. Backup del binario actual a /opt/aether-web/aether-web.previous
#   2. Para el servicio
#   3. Copia binarios y migrations nuevos
#   4. Backup de la BD (deploy/backup.sh)
#   5. Aplica migraciones pendientes
#   6. Arranca el servicio
#   7. Verifica /api/v1/health
#
# Si el health falla, hace rollback al binario previo y aborta.
#
# Uso (como root, desde el directorio extraído del tarball nuevo):
#   sudo ./deploy/update.sh
#
set -euo pipefail

INSTALL_DIR=/opt/aether-web
UNIT_NAME=aether-web.service
HEALTH_URL=http://127.0.0.1:8080/api/v1/health
HEALTH_TRIES=20
HEALTH_DELAY=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"

log() { printf '\e[1;34m==>\e[0m %s\n' "$*"; }
err() { printf '\e[1;31m!!\e[0m %s\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "Debe ejecutarse como root."
  exit 1
fi
if [[ ! -d "$INSTALL_DIR" ]]; then
  err "$INSTALL_DIR no existe. ¿Es la primera instalación? Usa install.sh."
  exit 1
fi
if [[ ! -f "$SRC_DIR/aether-web" ]]; then
  err "No encuentro el binario nuevo en $SRC_DIR/aether-web."
  exit 1
fi

# 1) Backup
log "Backup binario actual"
cp -a "$INSTALL_DIR/aether-web" "$INSTALL_DIR/aether-web.previous"
cp -a "$INSTALL_DIR/aether-bootstrap" "$INSTALL_DIR/aether-bootstrap.previous"

# 2) Parar servicio
log "Parando $UNIT_NAME"
systemctl stop "$UNIT_NAME"

# 3) Copiar binarios y migrations nuevos
log "Copiando binarios y migrations"
install -m 0755 -o root -g root "$SRC_DIR/aether-web"        "$INSTALL_DIR/aether-web"
install -m 0755 -o root -g root "$SRC_DIR/aether-bootstrap"  "$INSTALL_DIR/aether-bootstrap"
rm -rf "$INSTALL_DIR/migrations"
cp -r "$SRC_DIR/migrations" "$INSTALL_DIR/migrations"
chown -R root:root "$INSTALL_DIR/migrations"
chmod -R go-w "$INSTALL_DIR/migrations"

# units y deploy (por si cambiaron)
install -m 0644 -o root -g root "$SCRIPT_DIR/$UNIT_NAME" "/etc/systemd/system/$UNIT_NAME"
install -m 0644 -o root -g root "$SCRIPT_DIR/aether-backup.service" /etc/systemd/system/aether-backup.service
install -m 0644 -o root -g root "$SCRIPT_DIR/aether-backup.timer"   /etc/systemd/system/aether-backup.timer
rm -rf "$INSTALL_DIR/deploy"
cp -r "$SCRIPT_DIR" "$INSTALL_DIR/deploy"
systemctl daemon-reload
# Idempotente: activa el backup diario también en instalaciones anteriores al timer.
systemctl enable --now aether-backup.timer

# 4) Backup de la BD antes de migrar: si una migración rompe datos, hay
#    un punto de restauración inmediato (ver "Backups" en el README).
log "Backup de la base de datos previo a migraciones"
"$INSTALL_DIR/deploy/backup.sh"

# 5) Migraciones
log "Aplicando migraciones pendientes"
"$INSTALL_DIR/deploy/migrate-up.sh"

# 6) Arrancar
log "Arrancando $UNIT_NAME"
systemctl start "$UNIT_NAME"

# 7) Verificar health
log "Comprobando $HEALTH_URL"
ok=false
for ((i=1; i<=HEALTH_TRIES; i++)); do
  if curl -fsS -o /dev/null --max-time 2 "$HEALTH_URL"; then
    ok=true
    break
  fi
  sleep "$HEALTH_DELAY"
done

if ! $ok; then
  err "Health check falló tras $((HEALTH_TRIES*HEALTH_DELAY))s. Haciendo rollback."
  systemctl stop "$UNIT_NAME"
  mv "$INSTALL_DIR/aether-web.previous"       "$INSTALL_DIR/aether-web"
  mv "$INSTALL_DIR/aether-bootstrap.previous" "$INSTALL_DIR/aether-bootstrap"
  systemctl start "$UNIT_NAME"
  err "Rollback aplicado. Revisa journalctl -u $UNIT_NAME para diagnosticar."
  exit 1
fi

# Éxito: borra el backup
rm -f "$INSTALL_DIR/aether-web.previous" "$INSTALL_DIR/aether-bootstrap.previous"
log "Actualización OK."
