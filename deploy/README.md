# Despliegue de aether-web (Linux + systemd)

Runbook para instalar, actualizar y diagnosticar `aether-web` en un servidor
Debian/Ubuntu/RHEL con systemd.

## Resumen

- **Binario:** `/opt/aether-web/aether-web` (frontend embebido vía `go:embed`).
- **Servicio:** `aether-web.service` (systemd, `Type=simple`).
- **Configuración:** `/etc/aether-web/env` (variables de entorno, perms 600).
- **Datos:** PostgreSQL externo; el binario no escribe ficheros excepto logs vía journald.
- **Puerto por defecto:** `8080` (cambia con `AETHER_ADDR`).

## Estructura en el servidor

```
/opt/aether-web/
├── aether-web              # binario principal (server + SPA embebida)
├── aether-bootstrap        # CLI para crear el primer usuario admin
├── migrations/             # SQL de golang-migrate
└── deploy/                 # scripts + unit (este directorio)
/etc/aether-web/
└── env                     # AETHER_DATABASE_URL, AETHER_ADDR, AETHER_SESSION_TTL
/etc/systemd/system/
├── aether-web.service
├── aether-backup.service   # oneshot: deploy/backup.sh (pg_dump)
└── aether-backup.timer     # diario 03:30, Persistent=true
/var/backups/aether-web/
└── aether-YYYYmmdd-HHMMSS.dump   # retención 14 días
```

## Requisitos en el servidor

- Linux x86_64, systemd ≥ 232.
- PostgreSQL 15+ accesible (local o remoto). La BD y el rol deben existir antes
  de aplicar migraciones.
- `golang-migrate` CLI en `/usr/local/bin/migrate`:
  ```bash
  curl -L https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz \
    | sudo tar xz -C /usr/local/bin migrate
  ```
- `curl` (para los health checks del update).
- `pg_dump` / `pg_restore` (paquete `postgresql-client`), para los backups.

## Generar el tarball (en la máquina de build)

```bash
# Requiere Go 1.22+ y Node 20+
cd aether-web
make dist
# → dist/aether-web-linux-amd64.tar.gz
```

El target `dist` ejecuta `npm ci && npm run build` y embebe `web/dist/` en el
binario Go. El tarball contiene binarios + migrations + scripts.

## Primera instalación

En el servidor, copia el tarball y ejecuta:

```bash
sudo tar -xzf aether-web-linux-amd64.tar.gz -C /tmp
cd /tmp/aether-web
sudo ./deploy/install.sh
```

`install.sh` es idempotente. Crea:
- usuario y grupo de sistema `aether`,
- `/opt/aether-web/`, `/opt/aether-web/data/`,
- `/etc/aether-web/env` (desde la plantilla, si no existía),
- la unit en `/etc/systemd/system/`.

Después:

1. **Edita `/etc/aether-web/env`** con la DSN real:
   ```bash
   sudo vi /etc/aether-web/env
   ```
2. **Aplica migraciones**:
   ```bash
   sudo /opt/aether-web/deploy/migrate-up.sh
   ```
3. **Crea el primer usuario admin** (ver `aether-bootstrap --help`):
   ```bash
   sudo -u aether /opt/aether-web/aether-bootstrap …
   ```
4. **Habilita y arranca el servicio y el backup diario**:
   ```bash
   sudo systemctl enable --now aether-web
   sudo systemctl enable --now aether-backup.timer
   sudo systemctl status aether-web
   curl http://127.0.0.1:8080/api/v1/health
   ```

## Actualizaciones

Genera un tarball nuevo y, en el servidor:

```bash
sudo tar -xzf aether-web-linux-amd64.tar.gz -C /tmp
cd /tmp/aether-web
sudo ./deploy/update.sh
```

`update.sh`:
1. Guarda el binario actual como `.previous`.
2. Para el servicio.
3. Copia binarios + migrations nuevos.
4. Hace un backup de la BD (`deploy/backup.sh`).
5. Aplica migraciones pendientes.
6. Arranca el servicio.
7. Comprueba `/api/v1/health` durante 20s.
8. Si falla, hace **rollback automático** al binario anterior (la BD se
   restaura a mano desde el dump del paso 4 si la migración fue la causa).

## Backups

`aether-backup.timer` ejecuta `deploy/backup.sh` cada noche (03:30 ± 15 min;
`Persistent=true`, así que si el servidor estaba apagado se lanza al arrancar).
Además `update.sh` hace un dump justo antes de aplicar migraciones.

- **Destino:** `/var/backups/aether-web/aether-YYYYmmdd-HHMMSS.dump`
  (formato custom de `pg_dump`, comprimido, perms 600).
- **Retención:** 14 días (dumps más antiguos se borran en cada ejecución).
- **Overrides** (variables de entorno al invocar el script a mano):
  `AETHER_BACKUP_DIR`, `AETHER_BACKUP_RETENTION_DAYS`.
- **Backup manual:** `sudo /opt/aether-web/deploy/backup.sh`
- **Comprobar el timer:** `systemctl list-timers aether-backup.timer` y
  `journalctl -u aether-backup -n 20`.

> El dump queda en el mismo servidor: copia periódicamente
> `/var/backups/aether-web/` a otra máquina o disco (rsync, robocopy desde
> Windows, etc.). Un backup en el mismo disco no protege frente a fallo de
> hardware.

### Restaurar

Con el servicio parado, sobre la misma BD (borra y recrea los objetos):

```bash
sudo systemctl stop aether-web
# Carga la DSN sin imprimirla:
set -a; source /etc/aether-web/env; set +a
pg_restore --clean --if-exists --no-owner \
  --dbname "$AETHER_DATABASE_URL" \
  /var/backups/aether-web/aether-YYYYmmdd-HHMMSS.dump
sudo systemctl start aether-web
curl http://127.0.0.1:8080/api/v1/health
```

Para ensayar una restauración sin tocar producción, restaura sobre una BD
vacía de otro nombre (`createdb aether_restore` + `--dbname` apuntando a ella).
Conviene ensayarlo al menos una vez: un backup no verificado no es un backup.

## Diagnóstico

```bash
# Estado y últimas líneas de log
systemctl status aether-web
journalctl -u aether-web -n 100 --no-pager

# Logs en vivo
journalctl -u aether-web -f

# Health (público a propósito: lo usan update.sh, el frontend pre-login y
# la monitorización; solo expone ok/db_down)
curl -i http://127.0.0.1:8080/api/v1/health
# {"status":"ok"}        → BD accesible
# {"status":"db_down"}   → revisa AETHER_DATABASE_URL / red / pg_hba

# Forzar rearranque
sudo systemctl restart aether-web

# Comprobar que la unit está bien sintácticamente
sudo systemd-analyze verify aether-web.service
```

## Frontend embebido

`web/embed.go` declara `//go:embed all:dist`, así que **el binario contiene la
SPA**. No hay que servir archivos estáticos por separado ni configurar nginx
para SPA fallback — el handler `spaHandler` ya devuelve `index.html` para rutas
desconocidas. Si quieres ponerle nginx delante (TLS, host header), basta con
`proxy_pass http://127.0.0.1:8080;`.

## TLS (Caddy como reverse proxy)

Recomendado incluso en intranet: el login y la cookie de sesión viajan en
claro por HTTP, y hay datos personales (RGPD). En una red sin salida a
internet no hay Let's Encrypt, pero Caddy genera y renueva certificados con
una CA interna propia sin mantenimiento (`tls internal`).

1. Instala Caddy (paquete del SO: `apt install caddy`).
2. `/etc/caddy/Caddyfile` (sustituye `aether.local` por el hostname o IP con
   el que los usuarios acceden):
   ```
   aether.local {
       tls internal
       reverse_proxy 127.0.0.1:8080
   }
   ```
3. `sudo systemctl enable --now caddy`
4. **Distribuye la CA raíz a los PCs cliente** (una vez, por GPO o a mano),
   importándola como autoridad de confianza. Está en:
   `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`
5. En `/etc/aether-web/env`:
   ```
   AETHER_ADDR=127.0.0.1:8080   # deja de escuchar en 0.0.0.0; solo entra el proxy
   AETHER_COOKIE_SECURE=true
   AETHER_TRUSTED_PROXY=true    # auditoría con la IP real del usuario, no 127.0.0.1
   ```
   y `sudo systemctl restart aether-web`.

Los health checks de `update.sh` y el diagnóstico siguen funcionando igual:
atacan `127.0.0.1:8080` por HTTP desde la propia máquina.

## Variables de entorno

| Variable               | Default | Descripción                                                |
|------------------------|---------|------------------------------------------------------------|
| `AETHER_DATABASE_URL`  | —       | DSN pgx (`postgres://user:pass@host:5432/db?sslmode=...`). |
| `AETHER_ADDR`          | `:8080` | Host:puerto del HTTP (sin host = 0.0.0.0). Con proxy local: `127.0.0.1:8080`. |
| `AETHER_SESSION_TTL`   | `8h`    | TTL de la sesión. Duración Go o segundos.                  |
| `AETHER_COOKIE_SECURE` | `false` | `true` = cookie de sesión con flag `Secure`. Activar con TLS. |
| `AETHER_TRUSTED_PROXY` | `false` | `true` = IP del cliente desde `X-Forwarded-For`, confiando solo en un proxy en loopback. Solo con reverse proxy local. |

## Rollback manual

Si el rollback automático del `update.sh` no se disparó pero el binario nuevo
da problemas:

```bash
sudo systemctl stop aether-web
sudo mv /opt/aether-web/aether-web /opt/aether-web/aether-web.broken
sudo mv /opt/aether-web/aether-web.previous /opt/aether-web/aether-web
sudo systemctl start aether-web
# Revierte también migraciones si aplica:
# sudo /opt/aether-web/deploy/migrate-down.sh  (no incluido; usar `migrate ... down N`)
```

## Seguridad (lo que ya hace la unit)

- `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`.
- `ProtectHome=true`, `MemoryDenyWriteExecute=true`.
- `SystemCallFilter=@system-service`, `SystemCallArchitectures=native`.
- `CapabilityBoundingSet=` (vacío), `RestrictSUIDSGID=true`, `UMask=0077`.
- `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` (sin netlink/raw).
- Solo `/opt/aether-web/data` es escribible (resto del FS está r/o para el servicio).
- El servicio corre como `aether:aether` (UID/GID de sistema, sin shell).
- `/etc/aether-web/env` solo es legible por `root:aether` con perms 600.
- `systemd-analyze security aether-web` da la puntuación de exposición actual.

Para PostgreSQL: recomendado usar `sslmode=verify-full` cuando la BD es remota,
y limitar `pg_hba.conf` al rango de IPs del servidor.
