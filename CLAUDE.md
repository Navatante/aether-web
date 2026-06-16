# Aether-Web

Gestión de operaciones de vuelo de una escuadrilla de helicópteros: vuelos, horas, calificaciones, papeletas, ausencias y comisiones. App cliente-servidor en intranet: backend Go (Echo + sqlc + pgx) con la SPA React (Vite + TanStack Query + Radix) embebida vía `go:embed`, sobre PostgreSQL. Un único desarrollador.

Guía extensa (walkthroughs, setup paso a paso, despliegue, glosario): `docs/ARQUITECTURA.md`.

## Comandos

| Comando | Qué hace |
|---|---|
| `make run` | Backend en `:8080` (requiere `AETHER_DATABASE_URL`). |
| `cd web && npm run dev` | Frontend en `:5173`, proxy `/api` → `:8080`. |
| `make test` | Tests Go. Con `AETHER_TEST_DATABASE_URL` corre también los de integración (BD efímera, `internal/testdb`). |
| `make sqlc` | Regenera `internal/queries/` tras tocar `queries/*.sql`. |
| `make types` | Regenera `web/src/types/generated/` (tygo) tras tocar DTOs Go. CI falla si está desactualizado. |
| `make lint` / `make vet` / `make fmt` | golangci-lint / go vet / gofmt. |
| `make migrate-up` | Aplica migraciones pendientes (usa `$DATABASE_URL`). |
| `make dev-rebuild` | BD desde cero: drop+create, migraciones, datos SQLite, admin. |
| `make build-prod` / `make dist` | Binario de producción con frontend embebido / tarball desplegable. |

BD de desarrollo: contenedor Docker `aether-pg`. DSN típico: `postgres://aether_admin:CHANGEME@127.0.0.1:5432/aether?sslmode=disable` (sirve también para `AETHER_TEST_DATABASE_URL`). Estas credenciales son las que usa `make dev`/`pg-up` (variables `PG_SUPERUSER` / `DEV_DB_PASSWORD` del Makefile).

## Arquitectura backend

Cadena por capas: `queries/<dominio>.sql` → sqlc genera `internal/queries/` → `Service` (lógica de negocio) → `Handlers` (HTTP) → Echo.

- Un paquete por dominio en `internal/domain/<dominio>/`. Los grandes (flights, ratings, lookups, comisiones, dashboard) se dividen en `dto.go` (contrato JSON), `service.go` (negocio + sentinel errors) y `handlers.go` (parseo HTTP + `Register(g, authSvc)`); los pequeños lo reúnen todo en un único `<dominio>.go` (festivos, events…). Mismas piezas en ambos casos.
- Las rutas se registran explícitamente desde `cmd/server/main.go`; si un dominio no se enchufa ahí, sus rutas no existen. No hay descubrimiento mágico.
- Configuración solo vía `internal/config` (variables `AETHER_*`); no añadir `os.Getenv` en otros sitios. Sin `AETHER_DATABASE_URL` el proceso no arranca.
- RLS por código: las queries de datos por escuadrilla filtran siempre por `*_escuadrilla_fk` usando el `EscuadrillaID` de la sesión. Un test de guardia (`internal/queryguard/guard_test.go`, corre en `make test`) vigila esto: tras tocar `queries/*.sql`, toda sentencia nueva sobre datos por escuadrilla debe llevar el filtro o exentarse en `exemptBaseline` con su categoría; si no, CI falla.
- El insert de vuelos es transaccional (~12 tablas hijas) y setea los GUCs `aether.user_id`/`aether.ip_address` para el trigger de auditoría `tr_audit_flight`. Mismo patrón en las escrituras de `persons` (envueltas en tx con esas GUCs vía `withAudit`) para el trigger `tr_audit_person`; este enmascara el hash de contraseña (guarda solo `person_password_hash_present`, nunca el hash). Ambos triggers escriben en `detall.audit_log`.

### Cambio de escuadrilla de una persona (semántica "el pasado se queda donde se voló")

Una persona puede cambiar de escuadrilla. **No hay UI para ello** (la RLS-por-código encierra incluso al Superusuario en su escuadrilla): es un `UPDATE detall.person SET person_escuadrilla_fk` **manual en BD**. `person_escuadrilla_fk` es la escuadrilla **actual** (un único valor mutable). Modelo elegido y sus reglas:

- **El registro histórico se queda donde se generó.** Los datos "sellados" con su propia `*_escuadrilla_fk` (vuelos, comisiones, ausencias, calificaciones, papeletas, aeronaves…) **no se mueven nunca**; se quedan en la escuadrilla donde ocurrieron.
- **La persona desaparece de la escuadrilla antigua.** Todos los informes basan su *roster* en `person_escuadrilla_fk` actual, así que tras el cambio la persona solo aparece en la nueva. No se desacopla el roster del histórico.
- **Horas de vuelo — vista doble** (`queries/hours.sql`, `NH90PeriodHours`, flag `$5` = modo "Totales"):
  - *Por escuadrilla* (`$5=false`): `person_hour` cuenta **solo vuelos de la escuadrilla actual** (`AND ($5::bool OR f.flight_escuadrilla_fk = $3)`) → "horas voladas aquí, con el helicóptero de esta escuadrilla".
  - *Totales* (`$5=true`): `person_hour` **cruza escuadrillas** para esa persona (sin filtro de `flight_escuadrilla_fk`) y suma además `previous_hour` (arrastre vitalicio pre-Aether) → histórico completo. Es una **exención acotada a la RLS-por-código**: solo expone datos *propios* de personas del roster actual, nunca de terceros.
- **Comisión y esfuerzo siguen a la persona y acumulan** (`queries/comisiones.sql` `DiasComision`, `queries/esfuerzo.sql` `Esfuerzo`): ya son person-centric (roster por `person_escuadrilla_fk` actual, pero las subconsultas `person_comision`→`comision` **no** filtran `comision_escuadrilla_fk`). No requieren cambios al modelo.
- `operations.previous_hour` y `previous_model_real_hour`/`previous_model_sim_hour` son **person-centric** (sin `escuadrilla_fk`); no se ven afectados por el filtro por escuadrilla.

Descartadas: (2) re-sellar las FKs para migrar el histórico con la persona; (3) tabla `person_escuadrilla` con vigencias temporales.

### Contrato de errores

- Errores esperables (validación, not found, duplicado): sentinel error del dominio → `echo.NewHTTPError(4xx, mensajeSeguro)` en el handler.
- Cualquier otro error: **devolverlo sin envolver** (`return err`). El handler central (`internal/httpx/errors.go`) lo loguea con `request_id` y responde un 500 genérico.
- **Nunca** `echo.NewHTTPError(500, err.Error())`: filtra SQL/esquema al cliente.

### Permisos (sin jerarquía, salvo Superusuario)

`person_permission_level` ∈ {`Común`, `Operacional`, `Administrativo`, `Seguridad`, `Superusuario`}. Es una **allow-list exacta por ruta** — Administrativo NO incluye Operacional ni viceversa. Toda escritura lleva `auth.RequirePermission(...)` encadenado tras `auth.RequireAuth(...)`:

| Escrituras de… | Niveles admitidos |
|---|---|
| Vuelos, papeletas, eventos, lookups de vuelo (aeronaves, lugares) | Operacional |
| Personal, comisiones, festivos | Administrativo |
| Ausencias, calificaciones (crew / not-crew) | Operacional o Administrativo |
| Credenciales y nivel de permiso (panel, su escuadrilla) | Superusuario |
| Lecturas (GET) | Cualquier autenticado |

**Excepción god-mode (acotada a la escuadrilla)**: `Superusuario` es el **único nivel jerárquico** en cuanto a *permisos*: `RequirePermission` lo deja pasar por **cualquier** ruta protegida (bypass centralizado en `internal/auth/middleware.go`), presente o futura, sin listarlo en cada ruta; el frontend espeja esto (`hasPermission`/`canAccess` devuelven `true` para `SUPERUSUARIO`). Pero **NO** rompe la RLS por escuadrilla: igual que todos, opera solo sobre datos de su propia escuadrilla (sus rutas exclusivas `/superuser/persons*` filtran por el `EscuadrillaID` de la sesión). El primer Superusuario no se puede crear por la web (huevo-y-gallina): se fija con `go run ./cmd/bootstrap -user <u> -level Superusuario`. Salvaguarda: no se puede degradar al último Superusuario de la escuadrilla.

El gating de la UI (`hasPermission`) es solo cosmético; la garantía real es el 403 del backend.

## Convenciones frontend

1. **Componentes = solo render.** La lógica de datos/estado/handlers de páginas y diálogos no triviales vive en `features/<feature>/hooks/use<Nombre>.ts`. Referencias: `availability/hooks/useDisponibilidad.ts`, `personnel/hooks/usePersonnel.ts`, `comisiones/hooks/useComisionForm.ts`.
2. **Modelo compartido por feature** (tipos, catálogos, helpers usados por varios componentes): módulo propio, p. ej. `availability/absences.ts`.
3. **Diálogos multi-tab**: un archivo por tab en subcarpeta del diálogo (`flights/components/dialogs/manage-flight-data/`).
4. **Tipos de la API**: los structs Go son la fuente de verdad; tygo genera `web/src/types/generated/` (**no editar a mano**). Los `web/src/types/*.ts` son adaptadores finos que re-exportan con los nombres históricos (ver `types/dashboard.ts`); ahí sí van los tipos puramente de UI.
5. **Datos siempre por TanStack Query**: `useApiQuery` / `useApiMutation` / `useApiPaginatedQuery` (acepta genérico `TRaw` para tipar `transform`) con `queryKeys` + `invalidateKeys`. El patrón `http()` + `useState` + refetch manual está deprecado para queries.

## Reglas críticas

- **RGPD — jamás versionar en este repo (público)**: `database-utils/Aether.db`, `database-utils/person_users.json`, `migrations/0002_seed_lookups.up.sql`, `migrations/0004_seed_productive_data.up.sql`. Son symlinks al repo privado `aether-data` (por defecto `~/aether-data`). Los symlinks **están gitignored** (no viajan por git): se recrean por máquina con `make link-private` (ruta sobrescribible: `make link-private AETHER_DATA=/otra/ruta/aether-data`). Por eso la ruta del repo privado puede diferir entre máquinas sin romper nada. El CI tiene leak-guard, pero revisa `git status` antes de cada push igualmente. Nunca `git add -f`.
- **No editar código generado**: `internal/queries/` (sqlc) ni `web/src/types/generated/` (tygo).
- **Migraciones**: numeradas secuencialmente en `migrations/` (mira el último número antes de crear una; convenciones en `migrations/README.md`). Las de **esquema** llevan par `.up.sql`/`.down.sql`; las de **seed** (0002, 0004) son **solo-up** (dev hace drop+create y prod solo aplica `up`). Tras cambiar el esquema: actualizar `queries/*.sql` → `make sqlc` → DTOs → `make types`.
- **Timestamps**: usar `timestamptz`, nunca `TIMESTAMP` sin zona (las sesiones lo usan por un bug real de zonas horarias; el esquema de auth/sesión vive consolidado en `0001_init_schema`).
- Commits y push solo cuando el usuario lo pida; el frontend embebido (`web/dist/`) está versionado — reconstruirlo (`cd web && npm run build`) antes de commitear cambios de frontend relevantes.

## Otros documentos

- `docs/ARQUITECTURA.md` — guía extensa: arranque del binario, walkthrough de un dominio, tareas típicas ("cómo añado un endpoint/columna/lookup"), desarrollo local completo, repos público/privado, despliegue, glosario.
- `web/CLAUDE.md` — detalle operativo del frontend (recetas de hooks, queryKeys, lookups, tipos generados).
- `migrations/README.md` — convenciones de migraciones y qué archivos son symlinks al repo privado.
- `deploy/README.md` — runbook de producción (systemd, install/update con rollback).
