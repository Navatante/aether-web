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

BD de desarrollo: contenedor Docker `aether-pg`. DSN típico: `postgres://jon:1234@127.0.0.1:5432/aether?sslmode=disable` (sirve también para `AETHER_TEST_DATABASE_URL`).

## Arquitectura backend

Cadena por capas: `queries/<dominio>.sql` → sqlc genera `internal/queries/` → `Service` (lógica de negocio) → `Handlers` (HTTP) → Echo.

- Un paquete por dominio en `internal/domain/<dominio>/`. Los grandes (flights, ratings, lookups, comisiones, dashboard) se dividen en `dto.go` (contrato JSON), `service.go` (negocio + sentinel errors) y `handlers.go` (parseo HTTP + `Register(g, authSvc)`); los pequeños lo reúnen todo en un único `<dominio>.go` (festivos, events…). Mismas piezas en ambos casos.
- Las rutas se registran explícitamente desde `cmd/server/main.go`; si un dominio no se enchufa ahí, sus rutas no existen. No hay descubrimiento mágico.
- Configuración solo vía `internal/config` (variables `AETHER_*`); no añadir `os.Getenv` en otros sitios. Sin `AETHER_DATABASE_URL` el proceso no arranca.
- RLS por código: las queries de datos por escuadrilla filtran siempre por `*_escuadrilla_fk` usando el `EscuadrillaID` de la sesión.
- El insert de vuelos es transaccional (~12 tablas hijas) y setea los GUCs `aether.user_id`/`aether.ip_address` para el trigger de auditoría `tr_audit_flight`.

### Contrato de errores

- Errores esperables (validación, not found, duplicado): sentinel error del dominio → `echo.NewHTTPError(4xx, mensajeSeguro)` en el handler.
- Cualquier otro error: **devolverlo sin envolver** (`return err`). El handler central (`internal/httpx/errors.go`) lo loguea con `request_id` y responde un 500 genérico.
- **Nunca** `echo.NewHTTPError(500, err.Error())`: filtra SQL/esquema al cliente.

### Permisos (sin jerarquía)

`person_permission_level` ∈ {`Común`, `Operacional`, `Administrativo`, `Seguridad`}. Es una **allow-list exacta por ruta** — Administrativo NO incluye Operacional ni viceversa. Toda escritura lleva `auth.RequirePermission(...)` encadenado tras `auth.RequireAuth(...)`:

| Escrituras de… | Niveles admitidos |
|---|---|
| Vuelos, papeletas, eventos, lookups de vuelo (aeronaves, lugares) | Operacional |
| Personal, comisiones, festivos | Administrativo |
| Ausencias, calificaciones (crew / not-crew) | Operacional o Administrativo |
| Lecturas (GET) | Cualquier autenticado |

El gating de la UI (`hasPermission`) es solo cosmético; la garantía real es el 403 del backend.

## Convenciones frontend

1. **Componentes = solo render.** La lógica de datos/estado/handlers de páginas y diálogos no triviales vive en `features/<feature>/hooks/use<Nombre>.ts`. Referencias: `availability/hooks/useDisponibilidad.ts`, `personnel/hooks/usePersonnel.ts`, `comisiones/hooks/useComisionForm.ts`.
2. **Modelo compartido por feature** (tipos, catálogos, helpers usados por varios componentes): módulo propio, p. ej. `availability/absences.ts`.
3. **Diálogos multi-tab**: un archivo por tab en subcarpeta del diálogo (`flights/components/dialogs/manage-flight-data/`).
4. **Tipos de la API**: los structs Go son la fuente de verdad; tygo genera `web/src/types/generated/` (**no editar a mano**). Los `web/src/types/*.ts` son adaptadores finos que re-exportan con los nombres históricos (ver `types/dashboard.ts`); ahí sí van los tipos puramente de UI.
5. **Datos siempre por TanStack Query**: `useApiQuery` / `useApiMutation` / `useApiPaginatedQuery` (acepta genérico `TRaw` para tipar `transform`) con `queryKeys` + `invalidateKeys`. El patrón `http()` + `useState` + refetch manual está deprecado para queries.

## Reglas críticas

- **RGPD — jamás versionar en este repo (público)**: `database-utils/Aether.db`, `database-utils/person_users.json`, `migrations/0002_seed_lookups.*.sql`, `migrations/0005_seed_productive_data.*.sql`. Son symlinks al repo privado `~/aether-data`. El CI tiene leak-guard, pero revisa `git status` antes de cada push igualmente. Nunca `git add -f`.
- **No editar código generado**: `internal/queries/` (sqlc) ni `web/src/types/generated/` (tygo).
- **Migraciones**: numeradas secuencialmente con par `.up.sql`/`.down.sql` en `migrations/` (mira el último número antes de crear una; convenciones en `migrations/README.md`). Tras cambiar el esquema: actualizar `queries/*.sql` → `make sqlc` → DTOs → `make types`.
- **Timestamps**: usar `timestamptz`, nunca `TIMESTAMP` sin zona (la migración 0006 corrigió un bug real de sesiones por esto).
- Commits y push solo cuando el usuario lo pida; el frontend embebido (`web/dist/`) está versionado — reconstruirlo (`cd web && npm run build`) antes de commitear cambios de frontend relevantes.

## Otros documentos

- `docs/ARQUITECTURA.md` — guía extensa: arranque del binario, walkthrough de un dominio, tareas típicas ("cómo añado un endpoint/columna/lookup"), desarrollo local completo, repos público/privado, despliegue, glosario.
- `web/CLAUDE.md` — detalle operativo del frontend (recetas de hooks, queryKeys, lookups, tipos generados).
- `migrations/README.md` — convenciones de migraciones y qué archivos son symlinks al repo privado.
- `deploy/README.md` — runbook de producción (systemd, install/update con rollback).
