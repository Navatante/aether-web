# Aether-Web

Aplicación web para la gestión operativa de una escuadrilla de helicópteros: vuelos, horas, calificaciones de tripulantes, papeletas de instrucción, ausencias, comisiones y suministro de combustible. Sustituye a una aplicación de escritorio anterior basada en Tauri + SQL Server.

**Stack**: Go (Echo + sqlc + pgx) + React (Vite + TanStack Query + Radix) + PostgreSQL. Frontend embebido en el binario Go via `go:embed`.

## Estado

Migración Tauri → Web completada. 77 endpoints HTTP, 12 dominios, despliegue en un único binario por systemd. Detalles en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) (guía de arquitectura y convenciones).

## Privacidad

Este repositorio es **público y software libre (MIT)**, pero algunos artefactos no están versionados aquí por contener datos personales o información operativa específica de una escuadrilla real:

| Archivo | Por qué no está | Cómo conseguirlo |
|---|---|---|
| `database-utils/Aether.db` | BD SQLite con datos personales de militares (RGPD). | Repo privado separado, contacto con el autor. |
| `database-utils/person_users.json` | Mapeo `person_sk` → nombre de usuario. | Idem. Hay plantilla pública en `person_users.example.json`. |
| `migrations/0002_seed_lookups.up.sql` | Lookups con catálogo operativo específico (escuadrillas, papeletas históricas). | Idem. Hay plantilla en `migrations/examples/`. |
| `migrations/0005_seed_productive_data.up.sql` | Calificaciones, ausencias y comisiones reales. | Idem. |

Si quieres correr la aplicación contra tu propio dataset, los archivos `migrations/examples/*.sql.example` describen qué tablas hay que rellenar y con qué forma.

## Seguridad

- **Autenticación**: usuario + contraseña con **argon2id** (parámetros RFC 9106). Sesiones con token aleatorio de 32 bytes del que solo se guarda el hash SHA-256 en BD (`timestamptz`, purga periódica de caducadas); cookie `HttpOnly` + `SameSite=Lax` (+`Secure` con `AETHER_COOKIE_SECURE=true` tras TLS).
- **Autorización en el servidor**: cada ruta de escritura exige un nivel de permiso (`Común` / `Operacional` / `Administrativo` / `Seguridad`) vía middleware `RequirePermission` — el gating de la UI es solo cosmético, la garantía está en el backend (403). Reparto por dominio en [`docs/ARQUITECTURA.md` §8](docs/ARQUITECTURA.md#8-autenticación-y-sesiones).
- **Rate limit** en `/auth/login` por IP (ráfaga de 5, luego 1 cada 2 s) contra fuerza bruta.
- **Errores sin fugas**: handler central de errores; los 5xx devuelven un mensaje genérico y el detalle real (SQL, esquema) solo va al log, correlado por `X-Request-ID`.
- **Operación**: request logging JSON estructurado (journald), apagado ordenado con `SIGTERM`, timeouts HTTP y límite de body de 2 MB; la configuración se valida al arranque (sin DSN no arranca).
- **Auditoría**: trigger `tr_audit_flight` registra quién hizo qué (usuario e IP vía GUCs de sesión) en las escrituras de vuelos.

## Calidad y CI

GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)) en cada push y PR:

- **Leak-guard RGPD**: el job falla si algún archivo sensible (SQLite, seeds 0002/0005, mapeo de usuarios o cualquier `*.db`) aparece versionado.
- **Backend**: `go vet`, `golangci-lint`, build y tests — unitarios y de **integración** contra un PostgreSQL efímero (service container; en local, `AETHER_TEST_DATABASE_URL` + `make test`).
- **Frontend**: `npm ci` + typecheck/build de producción (`tsc -b` + Vite).
- **Contrato de tipos Go → TS**: los tipos de `web/src/types/generated/` se generan desde los structs Go con tygo (`make types`); el CI falla si están desactualizados.

## Desarrollo local

Resumen — guía completa en [`docs/ARQUITECTURA.md` §12](docs/ARQUITECTURA.md#12-desarrollo-local).

**Requisitos**: Go 1.22+, Node 20+, Docker, `sqlc`, `migrate` (golang-migrate).

```bash
# 1) PostgreSQL en docker
docker run -d --name aether-pg \
  -e POSTGRES_USER=aether_admin -e POSTGRES_PASSWORD=CHANGEME \
  -e POSTGRES_DB=aether \
  -p 5432:5432 postgres:18

# 2) Variables de entorno
export DATABASE_URL="postgres://aether_admin:CHANGEME@127.0.0.1:5432/aether?sslmode=disable"
export AETHER_DATABASE_URL="$DATABASE_URL"

# 3) Dependencias Python (para el script de carga SQLite)
python -m venv .venv && .venv/bin/pip install -r database-utils/requirements.txt

# 4) Reconstruir todo de cero (drop + create BD, migraciones, datos, admin)
#    DEV_USER debe coincidir con un person_user real de tus datos (ver nota abajo).
make dev-rebuild DEV_USER=jon DEV_PASSWORD=changeme

# 5) Arrancar
make run                              # terminal 1
cd web && npm install && npm run dev  # terminal 2
```

Abre `http://localhost:5173`. Login: `jon` / `changeme`.

> **Nota sobre `DEV_USER`.** El último paso de `make dev-rebuild` fija la contraseña de un usuario **que ya debe existir** en `detall.person` (no lo crea). El default del Makefile es `DEV_USER=admin`, que solo existe si usas el `person_users.example.json` público (mapea `sk 66 → admin`). Con el `person_users.json` privado real, ese `sk 66` es **`jon`**, así que hay que pasar `DEV_USER=jon` o el paso falla con `usuario no encontrado: admin`. Si solo falló ese último paso (la BD ya quedó cargada), basta con relanzar el bootstrap suelto:
>
> ```bash
> go run ./cmd/bootstrap -user jon -password changeme
> ```

## Despliegue en producción

`make dist` genera un tarball auto-contenido (~8 MB) con el binario, las migraciones y los scripts de instalación. Runbook en [`deploy/README.md`](deploy/README.md).

## Licencia

MIT — ver [`LICENSE`](LICENSE).
