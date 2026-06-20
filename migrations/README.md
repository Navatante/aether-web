# Migraciones

Migraciones SQL gestionadas con golang-migrate. Se aplican con `make migrate-up` (usa `$DATABASE_URL`); en producción las aplica `deploy/migrate-up.sh` durante `update.sh`.

## Convenciones

- Numeración secuencial `NNNN_nombre`. Mira el último número existente antes de crear una.
- Las migraciones de **esquema** llevan par `.up.sql` / `.down.sql`. Las de **seed** (0002, 0003) son **solo-up**: el ciclo de dev es _drop+create_ (`make dev-rebuild`) y producción solo aplica `up`, así que un `.down` de seed no se ejecuta nunca. La cima actual es el seed 0003 (solo-up), por lo que `migrate down 1` no la revierte: para resetear usa `make dev-rebuild`. `make reload-sqlite` re-importa el SQLite sin tocar migraciones (solo TRUNCATE + recarga).
- Timestamps siempre `timestamptz`, nunca `TIMESTAMP` sin zona (las sesiones lo usan por un bug real de zonas horarias; el esquema de auth/sesión vive consolidado en `0001`).
- Tras cambiar el esquema: actualizar `queries/*.sql` → `make sqlc` → DTOs Go → `make types`.

## ⚠️ Archivos sensibles (RGPD) — symlinks al repo privado

`0002_seed_lookups.up.sql` y `0003_seed_productive_data.up.sql` **no están versionados en este repo (público)**: son symlinks al repo privado `aether-data` (por defecto `~/aether-data`). Contienen catálogo operativo y datos personales reales. Son seeds **solo-up** (no hay `.down`): dev hace drop+create y prod solo aplica `up`.

- Los symlinks **están gitignored**, así que no viajan por git: se (re)crean en cada máquina con `make link-private` (ruta sobrescribible: `make link-private AETHER_DATA=/ruta/a/aether-data`). Por eso el repo privado puede vivir en una ruta distinta en cada máquina. `make link-private` es además idempotente: re-ejecútalo para reparar enlaces colgados.
- Editarlos funciona con normalidad (el symlink es transparente), pero el commit del cambio se hace **desde el repo privado `aether-data`**.
- Jamás `git add -f` sobre ellos aquí. El CI tiene leak-guard, pero revisa `git status` antes de cada push igualmente.
- Las plantillas públicas equivalentes (qué tablas rellenan y con qué forma) están en `examples/*.sql.example`.

## Orden de aplicación en desarrollo

La 0003 referencia personas (`person_sk`) que solo existen tras cargar los datos del SQLite. Por eso `make dev-rebuild` aplica primero 0001–`SCHEMA_CUTOFF` (2), luego carga el SQLite y después el resto. Si aplicas migraciones a mano sobre una BD vacía, no pases de la 0002 sin haber cargado antes los datos (`make load-sqlite`).

## Historial

| Nº | Qué hace |
|---|---|
| 0001 | Esquema completo (`detall`, `operations`, `flightsafety`) **+ auth** (`person_password_hash`, tabla `session` en `timestamptz`) **+ triggers** de invariantes y auditoría (`tr_audit_flight`, `tr_audit_person`). |
| 0002 | Seed de lookups (privado: catálogo operativo). |
| 0003 | Seed de datos productivos (privado: depende de personas). |

> Histórico: los antiguos `0003_auth_tables` y `0006_session_timestamptz` se consolidaron en `0001`; los triggers (ex-0003) y el seed productivo (ex-0004) se fusionaron en `0001` y `0003` respectivamente (squash pre-producción).
