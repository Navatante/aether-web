#!/usr/bin/env bash
#
# install.sh — primera instalación de aether-web en un servidor Linux con systemd.
#
# Idempotente: crea usuario, directorios, copia binarios, instala unit, recarga systemd.
# NO aplica migraciones (usa migrate-up.sh después de configurar /etc/aether-web/env).
#
# Uso (como root, desde el directorio extraído del tarball):
#   sudo ./deploy/install.sh
#
set -euo pipefail

# ------------------------------------------------------------------------------
INSTALL_DIR=/opt/aether-web
ETC_DIR=/etc/aether-web
DATA_DIR=$INSTALL_DIR/data
SERVICE_USER=aether
SERVICE_GROUP=aether
UNIT_NAME=aether-web.service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"   # el tarball coloca deploy/ junto al binario
# ------------------------------------------------------------------------------

log() { printf '\e[1;34m==>\e[0m %s\n' "$*"; }
err() { printf '\e[1;31m!!\e[0m %s\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "Debe ejecutarse como root (sudo)."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  err "systemctl no encontrado. Este script asume systemd."
  exit 1
fi

# 1) Usuario y grupo de servicio
if ! getent group "$SERVICE_GROUP" >/dev/null; then
  log "Creando grupo $SERVICE_GROUP"
  groupadd --system "$SERVICE_GROUP"
fi
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creando usuario $SERVICE_USER"
  useradd --system --gid "$SERVICE_GROUP" \
          --home-dir "$INSTALL_DIR" --no-create-home \
          --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# 2) Directorios
log "Preparando directorios"
install -d -m 0755 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$INSTALL_DIR"
install -d -m 0755 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$DATA_DIR"
install -d -m 0750 -o root           -g "$SERVICE_GROUP" "$ETC_DIR"

# 3) Binarios y migrations
log "Copiando binarios y migrations a $INSTALL_DIR"
install -m 0755 -o root -g root "$SRC_DIR/aether-web"        "$INSTALL_DIR/aether-web"
install -m 0755 -o root -g root "$SRC_DIR/aether-bootstrap"  "$INSTALL_DIR/aether-bootstrap"
rm -rf "$INSTALL_DIR/migrations"
cp -r "$SRC_DIR/migrations" "$INSTALL_DIR/migrations"
chown -R root:root "$INSTALL_DIR/migrations"
chmod -R go-w "$INSTALL_DIR/migrations"

rm -rf "$INSTALL_DIR/deploy"
cp -r "$SCRIPT_DIR" "$INSTALL_DIR/deploy"

# 4) Archivo de entorno (no sobreescribe si ya existe)
if [[ ! -f "$ETC_DIR/env" ]]; then
  log "Instalando $ETC_DIR/env desde plantilla. RECUERDA editarlo antes de arrancar."
  install -m 0600 -o root -g "$SERVICE_GROUP" "$SCRIPT_DIR/aether-web.env.example" "$ETC_DIR/env"
else
  log "$ETC_DIR/env ya existe, lo dejo intacto."
fi

# 5) Unit systemd
log "Instalando $UNIT_NAME"
install -m 0644 -o root -g root "$SCRIPT_DIR/$UNIT_NAME" "/etc/systemd/system/$UNIT_NAME"
systemctl daemon-reload

# 6) Resumen
cat <<EOF

\e[1;32m✓ Instalación base completa.\e[0m

Pasos siguientes:
  1. Edita \e[1m$ETC_DIR/env\e[0m con la DSN real (AETHER_DATABASE_URL).
  2. Aplica migraciones:
       cd $INSTALL_DIR && ./deploy/migrate-up.sh
  3. Crea el primer usuario admin:
       sudo -u $SERVICE_USER $INSTALL_DIR/aether-bootstrap <argumentos>
     (ver $INSTALL_DIR/aether-bootstrap --help)
  4. Habilita y arranca el servicio:
       systemctl enable --now $UNIT_NAME
  5. Comprueba:
       systemctl status $UNIT_NAME
       journalctl -u $UNIT_NAME -f
       curl http://127.0.0.1:8080/api/v1/health
EOF
