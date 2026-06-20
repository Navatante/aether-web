# CLAUDE.md

Aether-Web manages flight operations for a helicopter squadron. Client-server app on an intranet: Go backend (Echo + sqlc + pgx) with the React SPA (Vite + TanStack Query + Base UI) embedded via `go:embed`, on top of PostgreSQL. **Public** repo (MIT), single developer.

## Commands

| Command | What it does |
|---|---|
| `make run` | Backend on `:8080` (requires `AETHER_DATABASE_URL`). |
| `make dev` | Starts Postgres (docker), frontend in a separate window, and backend in this terminal. |
| `cd web && npm run dev` | Frontend on `:5173`, proxy `/api` → `:8080`. |
| `make test` | Go tests. With `AETHER_TEST_DATABASE_URL` also runs integration tests (ephemeral DB, `internal/testdb`). |
| `go test ./internal/auth/ -run TestX` | Single test/package. |
| `make sqlc` | Regenerates `internal/queries/` after touching `queries/*.sql`. |
| `make types` | Regenerates `web/src/types/generated/` (tygo) after touching Go DTOs. CI fails if out of date. |
| `make lint` / `make vet` / `make fmt` | golangci-lint / go vet / gofmt. |
| `make theme-guard` | Fails if there are hardcoded colors in frontend outside `web/src/app/theme.css`. |
| `make migrate-up` | Applies pending migrations (uses `$DATABASE_URL`). |
| `make dev-rebuild` | DB from scratch: drop+create, migrations, SQLite data, admin. See `DEV_USER` note in README. |
| `make build-prod` / `make dist` | Production binary with embedded frontend / deployable tarball. |

Dev database: Docker container `aether-pg`. Typical DSN: `postgres://aether_admin:CHANGEME@127.0.0.1:5432/aether?sslmode=disable` (also works for `AETHER_TEST_DATABASE_URL`). Requirements: Go 1.25+, Node 20+, Docker, `sqlc`, `migrate` (golang-migrate), `tygo`.

## Backend Architecture

Layered chain: `queries/<domain>.sql` → sqlc generates `internal/queries/` → `Service` (business logic) → `Handlers` (HTTP) → Echo.

- One package per domain in `internal/domain/<domain>/`. Large ones (flights, ratings, lookups, commissions, dashboard) are split into `dto.go` (JSON contract), `service.go` (business logic + sentinel errors), and `handlers.go` (HTTP parsing + `Register(g, authSvc)`); small ones consolidate everything in a single `<domain>.go` (holidays, events…). Same pieces in both cases.
- Routes are registered explicitly from `cmd/server/main.go`; if a domain isn't wired in there (build handler + `.Register(api, authSvc)`), its routes don't exist. No magic discovery.
- Configuration only via `internal/config` (`AETHER_*` variables); do not add `os.Getenv` elsewhere. Without `AETHER_DATABASE_URL` the process won't start.
- Code-level RLS: queries for squadron-scoped data always filter by `*_escuadrilla_fk` using the `EscuadrillaID` from the session. A guard test (`internal/queryguard/guard_test.go`, runs on `make test`) enforces this: after touching `queries/*.sql`, every new statement on squadron-scoped data must carry the filter or be exempted in `exemptBaseline` with its category; otherwise CI fails.
- The flight insert is transactional (~12 child tables) and sets GUCs `aether.user_id`/`aether.ip_address` for the audit trigger `tr_audit_flight`. Same pattern for `persons` writes (wrapped in tx with those GUCs via `withAudit`) for the trigger `tr_audit_person`; it masks the password hash (stores only `person_password_hash_present`, never the hash). Both triggers write to `detall.audit_log`.


### Error Contract

- Expected errors (validation, not found, duplicate): domain sentinel error → `echo.NewHTTPError(4xx, safeMessage)` in the handler.
- Any other error: **return it unwrapped** (`return err`). The central handler (`internal/httpx/errors.go`) logs it with `request_id` and returns a generic 500.
- **Never** `echo.NewHTTPError(500, err.Error())`: leaks SQL/schema to the client.

### Permissions (no hierarchy, except Superuser)

`person_permission_level` ∈ {`Común`, `Operacional`, `Administrativo`, `Seguridad`, `Superusuario`}. This is an **exact allow-list per route** — Administrativo does NOT include Operacional and vice versa. Every write carries `auth.RequirePermission(...)` chained after `auth.RequireAuth(...)`:

| Writes for… | Allowed levels |
|---|---|
| Flights, slips, events, flight lookups (aircraft, locations) | Operacional |
| Personnel, commissions, holidays | Administrativo |
| Absences, ratings (crew / not-crew) | Operacional or Administrativo |
| Credentials and permission level (panel, own squadron) | Superusuario |
| Reads (GET) | Any authenticated user |

**God-mode exception (scoped to squadron)**: `Superusuario` is the only hierarchical level in *permissions*: `RequirePermission` lets it through any protected route (bypass centralized in `internal/auth/middleware.go`); the frontend mirrors this. But it does **NOT** break squadron-level RLS. The first Superuser cannot be created via the web: `go run ./cmd/bootstrap -user <u> -level Superusuario`. Safeguard: the last Superuser of a squadron cannot be downgraded. UI gating (`hasPermission`) is cosmetic only; the real guarantee is the 403 from the backend.

## Frontend Conventions

Operational detail in `web/CLAUDE.md`.

1. **Components = render only.** Data/state/handler logic lives in `features/<feature>/hooks/use<Name>.ts`.
2. **Shared model per feature** (types, catalogs, helpers): own module, e.g. `availability/absences.ts`.
3. **Multi-tab dialogs**: one file per tab in a subfolder of the dialog (`flights/components/dialogs/manage-flight-data/`).
4. **API types**: Go structs are the source of truth; tygo generates `web/src/types/generated/` (**do not edit manually**). The `web/src/types/*.ts` files are thin adapters that re-export with historical names; purely UI types go there.
5. **Data always via TanStack Query**: `useApiQuery` / `useApiMutation` / `useApiPaginatedQuery` with `queryKeys` + `invalidateKeys`. The `http()` + `useState` + manual refetch pattern is deprecated for queries.

## Critical Rules

- **GDPR — never version in this repo (public)**: `database-utils/Aether.db`, `database-utils/person_users.json`, `migrations/0002_seed_lookups.up.sql`, `migrations/0004_seed_productive_data.up.sql`. These are symlinks to the private repo `aether-data` (default `~/aether-data`), **gitignored**: recreated per machine with `make link-private` (path overridable with `AETHER_DATA=`). CI has a leak-guard, but review `git status` before each push anyway. Never `git add -f`.
- **Do not edit generated code**: `internal/queries/` (sqlc) or `web/src/types/generated/` (tygo).
- **Timestamps**: use `timestamptz`, never `TIMESTAMP` without timezone (real timezone bug; the auth/session schema lives consolidated in `0001_init_schema`).
- Commits and pushes only when the user asks; the embedded frontend (`web/dist/`) is versioned — rebuild it (`cd web && npm run build`) before committing relevant frontend changes.

## Other Documents

- `docs/ARQUITECTURA.md` — extensive guide: binary startup, domain walkthrough, common tasks, local development, public/private repos, deployment, glossary.
- `web/CLAUDE.md` — frontend operational detail (hook recipes, queryKeys, lookups, generated types).
- `migrations/README.md` — migration conventions and which files are symlinks to the private repo.
- `deploy/README.md` — production runbook (systemd, install/update with rollback).
