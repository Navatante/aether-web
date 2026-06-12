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
└── aether-web.service
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
4. **Habilita y arranca el servicio**:
   ```bash
   sudo systemctl enable --now aether-web
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
4. Aplica migraciones pendientes.
5. Arranca el servicio.
6. Comprueba `/api/v1/health` durante 20s.
7. Si falla, hace **rollback automático** al binario anterior.

## Diagnóstico

```bash
# Estado y últimas líneas de log
systemctl status aether-web
journalctl -u aether-web -n 100 --no-pager

# Logs en vivo
journalctl -u aether-web -f

# Health
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

## Variables de entorno

| Variable               | Default | Descripción                                                |
|------------------------|---------|------------------------------------------------------------|
| `AETHER_DATABASE_URL`  | —       | DSN pgx (`postgres://user:pass@host:5432/db?sslmode=...`). |
| `AETHER_ADDR`          | `:8080` | Host:puerto del HTTP (sin host = 0.0.0.0).                 |
| `AETHER_SESSION_TTL`   | `8h`    | TTL de la sesión. Duración Go o segundos.                  |

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
- Solo `/opt/aether-web/data` es escribible (resto del FS está r/o para el servicio).
- El servicio corre como `aether:aether` (UID/GID de sistema, sin shell).
- `/etc/aether-web/env` solo es legible por `root:aether` con perms 600.

Para PostgreSQL: recomendado usar `sslmode=verify-full` cuando la BD es remota,
y limitar `pg_hba.conf` al rango de IPs del servidor.
