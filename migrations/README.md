# Migraciones

Migraciones SQL gestionadas con golang-migrate. Se aplican con `make migrate-up` (usa `$DATABASE_URL`); en producción las aplica `deploy/migrate-up.sh` durante `update.sh`.

## Convenciones

- Numeración secuencial `NNNN_nombre`, siempre en par `.up.sql` / `.down.sql`. Mira el último número existente antes de crear una.
- Timestamps siempre `timestamptz`, nunca `TIMESTAMP` sin zona (la 0006 corrigió un bug real de sesiones por esto).
- Tras cambiar el esquema: actualizar `queries/*.sql` → `make sqlc` → DTOs Go → `make types`.

## ⚠️ Archivos sensibles (RGPD) — symlinks al repo privado

`0002_seed_lookups.*.sql` y `0005_seed_productive_data.*.sql` **no están versionados en este repo (público)**: son symlinks a `~/aether-data` (repo privado). Contienen catálogo operativo y datos personales reales.

- Editarlos funciona con normalidad (el symlink es transparente), pero el commit del cambio se hace **desde `~/aether-data`**, al repo privado.
- Jamás `git add -f` sobre ellos aquí. El CI tiene leak-guard, pero revisa `git status` antes de cada push igualmente.
- Las plantillas públicas equivalentes (qué tablas rellenan y con qué forma) están en `examples/*.sql.example`.

## Orden de aplicación en desarrollo

La 0005 referencia personas (`person_sk`) que solo existen tras cargar los datos del SQLite. Por eso `make dev-rebuild` aplica primero 0001–`SCHEMA_CUTOFF` (4), luego carga el SQLite y después el resto. Si aplicas migraciones a mano sobre una BD vacía, no pases de la 0004 sin haber cargado antes los datos (`make load-sqlite`).

## Historial

| Nº | Qué hace |
|---|---|
| 0001 | Esquema inicial (`detall`, `operations`, `flightsafety`). |
| 0002 | Seed de lookups (privado: catálogo operativo). |
| 0003 | Tablas de auth (usuarios, sesiones). |
| 0004 | Triggers de invariantes y auditoría (`tr_audit_flight`). |
| 0005 | Seed de datos productivos (privado: depende de personas). |
| 0006 | Sesiones a `timestamptz` (fix de zonas horarias). |