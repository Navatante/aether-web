# Aether-Web

Aplicación web para la gestión operativa de una escuadrilla de helicópteros: vuelos, horas, calificaciones de tripulantes, papeletas de instrucción, ausencias, comisiones y suministro de combustible. Sustituye a una aplicación de escritorio anterior basada en Tauri + SQL Server.

**Stack**: Go (Echo + sqlc + pgx) + React (Vite + TanStack Query + Radix) + PostgreSQL. Frontend embebido en el binario Go via `go:embed`.

## Estado

Migración Tauri → Web completada. 77 endpoints HTTP, 12 dominios, despliegue en un único binario por systemd. Detalles en [`CLAUDE.md`](CLAUDE.md) (guía de arquitectura y convenciones).

## Privacidad

Este repositorio es **público y software libre (MIT)**, pero algunos artefactos no están versionados aquí por contener datos personales o información operativa específica de una escuadrilla real:

| Archivo | Por qué no está | Cómo conseguirlo |
|---|---|---|
| `database-utils/Aether.db` | BD SQLite con datos personales de militares (RGPD). | Repo privado separado, contacto con el autor. |
| `database-utils/person_users.json` | Mapeo `person_sk` → nombre de usuario. | Idem. Hay plantilla pública en `person_users.example.json`. |
| `migrations/0002_seed_lookups.up.sql` | Lookups con catálogo operativo específico (escuadrillas, papeletas históricas). | Idem. Hay plantilla en `migrations/examples/`. |
| `migrations/0005_seed_productive_data.up.sql` | Calificaciones, ausencias y comisiones reales. | Idem. |

Si quieres correr la aplicación contra tu propio dataset, los archivos `migrations/examples/*.sql.example` describen qué tablas hay que rellenar y con qué forma.

## Desarrollo local

Resumen — guía completa en [`CLAUDE.md` §12](CLAUDE.md#12-desarrollo-local).

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
make dev-rebuild

# 5) Arrancar
make run                              # terminal 1
cd web && npm install && npm run dev  # terminal 2
```

Abre `http://localhost:5173`.

## Despliegue en producción

`make dist` genera un tarball auto-contenido (~8 MB) con el binario, las migraciones y los scripts de instalación. Runbook en [`deploy/README.md`](deploy/README.md).

## Licencia

MIT — ver [`LICENSE`](LICENSE).
