# Migraciones

Migraciones SQL gestionadas con golang-migrate. Se aplican con `make migrate-up` (usa `$DATABASE_URL`); en producción las aplica `deploy/migrate-up.sh` durante `update.sh`.

## Convenciones

- Numeración secuencial `NNNN_nombre`. Mira el último número existente antes de crear una.
- Las migraciones de **esquema** llevan par `.up.sql` / `.down.sql`. Las de **seed** (0002, 0004) son **solo-up**: el ciclo de dev es _drop+create_ (`make dev-rebuild`) y producción solo aplica `up`, así que un `.down` de seed no se ejecuta nunca. La cima actual es el seed 0004 (solo-up), por lo que `migrate down 1` no la revierte: para resetear usa `make dev-rebuild`. `make reload-sqlite` re-importa el SQLite sin tocar migraciones (solo TRUNCATE + recarga).
- Timestamps siempre `timestamptz`, nunca `TIMESTAMP` sin zona (las sesiones lo usan por un bug real de zonas horarias; el esquema de auth/sesión vive consolidado en `0001`).
- Tras cambiar el esquema: actualizar `queries/*.sql` → `make sqlc` → DTOs Go → `make types`.

## ⚠️ Archivos sensibles (RGPD) — symlinks al repo privado

`0002_seed_lookups.*.sql` y `0004_seed_productive_data.*.sql` **no están versionados en este repo (público)**: son symlinks a `~/GolandProjects/aether-data` (repo privado), que debe estar clonado **junto a** `aether-web` (mismo directorio padre): los symlinks son relativos (`../../aether-data/...`) y no resuelven si el repo privado vive en otra ruta. Contienen catálogo operativo y datos personales reales.

- Editarlos funciona con normalidad (el symlink es transparente), pero el commit del cambio se hace **desde `~/GolandProjects/aether-data`**, al repo privado.
- Jamás `git add -f` sobre ellos aquí. El CI tiene leak-guard, pero revisa `git status` antes de cada push igualmente.
- Las plantillas públicas equivalentes (qué tablas rellenan y con qué forma) están en `examples/*.sql.example`.

## Orden de aplicación en desarrollo

La 0004 referencia personas (`person_sk`) que solo existen tras cargar los datos del SQLite. Por eso `make dev-rebuild` aplica primero 0001–`SCHEMA_CUTOFF` (3), luego carga el SQLite y después el resto. Si aplicas migraciones a mano sobre una BD vacía, no pases de la 0003 sin haber cargado antes los datos (`make load-sqlite`).

## Historial

| Nº | Qué hace |
|---|---|
| 0001 | Esquema inicial (`detall`, `operations`, `flightsafety`) **+ auth** (`person_password_hash`, tabla `session` en `timestamptz`). |
| 0002 | Seed de lookups (privado: catálogo operativo). |
| 0003 | Triggers de invariantes y auditoría (`tr_audit_flight`). |
| 0004 | Seed de datos productivos (privado: depende de personas). |

> Histórico: los antiguos `0003_auth_tables` y `0006_session_timestamptz` se consolidaron en `0001`; triggers y seed productivo se renumeraron a 0003/0004 (squash pre-producción).