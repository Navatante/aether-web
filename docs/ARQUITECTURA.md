# Aether-Web — Guía de arquitectura y desarrollo

> Referencia extensa de arquitectura, convenciones y tareas típicas. Nació
> como la guía de la migración Tauri → Web (ya completada). El contexto
> conciso para Claude Code vive en `CLAUDE.md`, en la raíz del repo.

Este documento explica **cómo está organizado el código**, y **cómo trabajar con él** sin ser experto en Go o aplicaciones web. Pensado para que puedas:

- Entender qué hace cada capa (frontend, backend, base de datos).
- Localizar dónde tocar para un cambio típico (añadir endpoint, columna, lookup, etc.).
- Levantar el entorno local de desarrollo.
- Desplegar el binario en el servidor.

> Cuando aparezca un término técnico en negrita la primera vez, hay un glosario al final.

---

## Índice

1. [Resumen: qué cambió y por qué](#1-resumen-qué-cambió-y-por-qué)
2. [Arquitectura en una pantalla](#2-arquitectura-en-una-pantalla)
3. [Mapa de directorios](#3-mapa-de-directorios)
4. [Cómo arranca el binario (`cmd/server/main.go`)](#4-cómo-arranca-el-binario-cmdservermaingo)
5. [Conceptos de Go que necesitas conocer](#5-conceptos-de-go-que-necesitas-conocer)
6. [Pila del backend: PostgreSQL → sqlc → service → handlers → HTTP](#6-pila-del-backend-postgresql--sqlc--service--handlers--http)
7. [Walkthrough completo: el dominio "festivos"](#7-walkthrough-completo-el-dominio-festivos)
8. [Autenticación y sesiones](#8-autenticación-y-sesiones)
9. [El frontend React](#9-el-frontend-react)
10. [Patrones repetidos en el frontend (lookups, queries, mutaciones)](#10-patrones-repetidos-en-el-frontend-lookups-queries-mutaciones)
11. [Tareas típicas: cómo hacer X](#11-tareas-típicas-cómo-hacer-x)
12. [Desarrollo local](#12-desarrollo-local)
13. [Estructura de repositorios (público + privado)](#13-estructura-de-repositorios-público--privado)
14. [Despliegue en producción](#14-despliegue-en-producción)
15. [Diferencias deliberadas con la app Tauri original](#15-diferencias-deliberadas-con-la-app-tauri-original)
16. [Glosario](#16-glosario)

---

## 1. Resumen: qué cambió y por qué

**Antes (Aether-Tauri):** una app de escritorio que combinaba:
- React (frontend, en una `WebView` que abría Tauri).
- Rust (backend, dentro del mismo binario, ejecutando `invoke` desde React).
- SQL Server (base de datos).
- Distribución: instalador NSIS por puesto. Cada PC tenía su propio binario y se actualizaba individualmente.

**Ahora (Aether-Web):** una app web cliente-servidor:
- React (frontend, sirve igual pero contra HTTP).
- **Go** (backend, binario en el servidor que expone una API REST).
- **PostgreSQL** (base de datos).
- Distribución: un único binario en el servidor; los usuarios entran por URL desde el navegador. Actualizar = swap del binario en el servidor.

### Motivos clave

1. **Menos fricción de despliegue.** Un binario nuevo sustituye al anterior en el servidor. No hace falta tocar los PCs.
2. **Auditoría centralizada.** Todos los logs y trazas se generan en un único proceso.
3. **Acceso flexible.** Cualquier PC de la red corporativa puede usar la app abriendo el navegador.

### Trazabilidad de hitos

La migración se hizo en 6 hitos:

| Hito | Qué hace                                                 |
|------|----------------------------------------------------------|
| 0    | Esqueleto del repo Go y embed del frontend.              |
| 1    | Esquema PostgreSQL + datos semilla + triggers de invariantes. |
| 2    | Auth: login, sesión por cookie, argon2id.                |
| 3    | Slice vertical "dashboard" como prueba de concepto.     |
| 4    | Resto de endpoints (77 endpoints, 12 dominios).          |
| 5    | Frontend cambiado de `invoke` Tauri a `fetch` HTTP.      |
| 6    | Build de producción, systemd, scripts de instalación.   |
| 7    | Migración de datos productivos SQLite → PostgreSQL (script Python + migración 0005). |

Estado al cierre: backend 77/77 endpoints, frontend 8/8 sub-lotes, despliegue listo. Ya no queda ningún rastro de Tauri en el código.

---

## 2. Arquitectura en una pantalla

```
┌────────────────────────────────────────────────────────────────────┐
│                       Navegador del usuario                       │
│                                                                    │
│   React SPA (Vite build → JavaScript + HTML + CSS estáticos)      │
│                                                                    │
│   • Cookie aether_session (HttpOnly) en todas las peticiones.     │
│   • Hooks useApiQuery / useApiMutation hacen fetch a /api/v1/*.   │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTP (intranet)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│              Binario  aether-web  (Go, en el servidor)            │
│                                                                    │
│   /api/v1/auth/*                  ← login/logout/me                │
│   /api/v1/health                  ← ¿estoy vivo? ¿BD ok?           │
│   /api/v1/dashboard/*             ← Endpoints por dominio.         │
│   /api/v1/flights, /lookups/...                                    │
│                                                                    │
│   /*  (resto)                     ← Sirve la SPA embebida          │
│                                      (frontend en go:embed).      │
│                                                                    │
│   Framework HTTP:    Echo                                          │
│   Driver PostgreSQL: pgx (pool de conexiones)                      │
│   SQL tipado:        sqlc (generado a partir de queries .sql)      │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ TCP/IP, sslmode opcional
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                          PostgreSQL                                │
│                                                                    │
│   • Esquemas: detall, operations, flightsafety.                   │
│   • Tablas, triggers de invariantes (no-overlap, etc.),           │
│     auditoría (`tr_audit_flight`).                                │
│   • Migraciones gestionadas con golang-migrate (.sql en           │
│     `migrations/`).                                               │
└────────────────────────────────────────────────────────────────────┘
```

Puntos clave:
- **El frontend y el backend conviven en el mismo binario**. `go:embed` mete la SPA dentro del ejecutable Go. Vas al servidor en el puerto 8080, te sirve `index.html` y los JS; ese JS hace llamadas HTTP a `/api/v1/*` contra el mismo origen.
- **No hay puente Tauri**. El navegador no tiene acceso privilegiado: solo HTTP + cookie.
- **PostgreSQL es externo al binario**. El binario abre un *pool* de conexiones al arrancar.

---

## 3. Mapa de directorios

```
aether-web/
├── cmd/
│   ├── server/main.go          # Punto de entrada principal.
│   └── bootstrap/main.go       # CLI para crear el primer admin.
│
├── internal/                   # Código Go privado del módulo.
│   ├── auth/                   # Login, sesiones, middleware RequireAuth.
│   ├── config/                 # Lectura de variables de entorno.
│   ├── db/pool.go              # Crea el pool pgx desde AETHER_DATABASE_URL.
│   ├── domain/                 # Un subdirectorio por dominio funcional.
│   │   ├── dashboard/
│   │   ├── flights/
│   │   ├── persons/
│   │   ├── papeletas/
│   │   ├── festivos/
│   │   ├── events/
│   │   ├── availability/
│   │   ├── comisiones/
│   │   ├── ratings/
│   │   ├── training/
│   │   ├── hours/
│   │   ├── esfuerzo/
│   │   └── lookups/            # GET /lookups/:name (datos de selectores).
│   ├── httpx/                  # Error handler central + endpoint POST /logs.
│   ├── logger/                 # slog (logger estándar de Go) preconfigurado.
│   └── queries/                # CÓDIGO GENERADO por sqlc. No tocar a mano.
│
├── queries/                    # Queries SQL fuente para sqlc.
│   ├── dashboard.sql
│   ├── festivos.sql
│   └── ...                     # Una por dominio.
│
├── migrations/                 # Migraciones SQL (golang-migrate).
│   ├── 0001_init_schema.up.sql
│   ├── 0001_init_schema.down.sql
│   ├── 0002_seed_lookups.up.sql
│   ├── 0003_auth_tables.up.sql
│   ├── 0004_triggers.up.sql
│   ├── 0005_seed_productive_data.up.sql  # Papeletas nuevas, calificaciones, etc.
│   └── 0006_session_timestamptz.up.sql   # Sesiones a timestamptz (fix de zonas horarias).
│
├── web/                        # Frontend.
│   ├── src/                    # Código React/TypeScript.
│   │   ├── app/App.tsx         # Composición raíz + rutas.
│   │   ├── lib/
│   │   │   ├── http.ts         # Wrapper fetch (cookie incluida).
│   │   │   ├── apiQuery.ts     # Hooks TanStack Query (use*ApiQuery).
│   │   │   ├── queryKeys.ts    # Catálogo de queryKeys (cache invalidation).
│   │   │   └── logger.ts       # Envía logs al backend (POST /logs).
│   │   ├── providers/          # UserProvider, DatabaseProvider, ThemeProvider.
│   │   ├── features/           # Una carpeta por feature de UI.
│   │   ├── shared/             # Componentes y hooks compartidos.
│   │   └── components/         # UI primitives (Radix/shadcn).
│   ├── dist/                   # Output de `npm run build`. Embebido en Go.
│   ├── embed.go                # //go:embed all:dist (lo embebe).
│   ├── package.json
│   └── vite.config.ts
│
├── deploy/                     # Artefactos de despliegue.
│   ├── aether-web.service      # Unit systemd.
│   ├── aether-web.env.example  # Plantilla EnvironmentFile.
│   ├── install.sh
│   ├── update.sh
│   ├── migrate-up.sh
│   └── README.md               # Runbook de despliegue.
│
├── CLAUDE.md                   # Contexto conciso para Claude Code.
├── docs/ARQUITECTURA.md        # ESTE DOCUMENTO (guía extensa).
├── Makefile                    # Comandos `make run`, `make build-prod`...
├── sqlc.yaml                   # Configuración del generador sqlc.
├── go.mod / go.sum             # Dependencias Go.
└── database-utils/             # Scripts Python de migración de datos.
    ├── migrationSQLiteToPostgres.py  # SQLite (Aether-Tauri) → PostgreSQL.
    └── requirements.txt             # Dependencias (psycopg).
```

> Si abres GoLand y te pierdes: **`cmd/server/main.go`** es el "main()" — el punto donde todo arranca. Para entender qué hace un endpoint, sigue de ahí hacia los handlers del dominio que toque.

---

## 4. Cómo arranca el binario (`cmd/server/main.go`)

Cuando ejecutas `aether-web` (o `make run`), pasa esto, en orden:

1. **Crea un logger** que escribe JSON estructurado a stdout (lo recoge journald en producción).
2. **Carga y valida la configuración** con `internal/config` (todas las `AETHER_*` se leen ahí y solo ahí). Si falta `AETHER_DATABASE_URL`, el proceso termina con un error claro: no hay DSN por defecto.
3. **Abre el pool pgx** (`db.New(...)`). Si la BD no responde, el proceso termina con código 1.
4. **Construye el servicio de auth** (`auth.NewService(pool, sessionTTL)`).
5. **Carga el frontend embebido** desde `web/embed.go` (la SPA buildeada con Vite).
6. **Crea la instancia Echo** (el framework HTTP) y le pone middleware:
   - `HTTPErrorHandler` central (`internal/httpx/errors.go`) — los 4xx con mensaje seguro pasan tal cual; cualquier otro error se loguea con el request ID y responde un 500 genérico (sin filtrar SQL ni esquema al navegador).
   - `Recover` — atrapa panics y devuelve 500 en vez de crashear.
   - `RequestID` — añade un `X-Request-ID` a cada request para correlar logs.
   - `RequestLogger` — una línea JSON por request a `/api/*` (método, ruta, status, latencia, IP, usuario, request_id). El health-check y los assets de la SPA no se loguean.
   - `BodyLimit("2M")` — rechaza bodies desproporcionados.
7. **Instancia los handlers de cada dominio**:
   ```go
   dashboardHandlers := dashboard.NewHandlers(dashboard.NewService(pool))
   lookupsHandlers   := lookups.NewHandlers(lookups.NewService(pool))
   // ... uno por dominio
   ```
8. **Registra rutas** bajo `/api/v1`:
   ```go
   api := e.Group("/api/v1")
   api.GET("/health", healthHandler(pool))
   authHandlers.Register(api)
   dashboardHandlers.Register(api, authSvc)
   // ... uno por dominio
   ```
   Cada `Register(...)` declara sus propias rutas (`GET /flights`, `POST /flights`, etc.) y aplica `RequireAuth(authSvc)` donde haga falta, más `RequirePermission(...)` en las escrituras (ver sección 8).
9. **Registra el handler de SPA** (`spaHandler`) en `/*`, fuera de `/api/v1`. Si el path coincide con un archivo del frontend embebido, lo sirve; si no, devuelve `index.html` (fallback de SPA para que React Router maneje rutas como `/flights`).
10. **Lanza la purga periódica de sesiones**: una goroutine borra de `detall.session` las sesiones caducadas cada hora.
11. **Arranca el servidor HTTP** en `:8080` (o lo que diga `AETHER_ADDR`), con timeouts (`ReadHeader` 5s, `Read` 30s, `Write` 60s, `Idle` 120s). Con `SIGTERM`/`SIGINT` hace **apagado ordenado**: deja de aceptar conexiones, espera hasta 10s a que terminen las requests en vuelo y sale limpio.

**Tres claves para no perderte:**

- *Cualquier* nueva ruta tiene que registrarse desde un `Register(...)` de algún dominio, y este dominio tiene que enchufarse desde `main.go`. Si no aparece en `main.go`, no existe.
- *Cualquier* lectura de configuración debe ser por variable de entorno (`AETHER_*`). No leemos archivos de configuración en runtime.
- *No* hay descubrimiento mágico de rutas. La lista que ves en `main.go` es exhaustiva.

---

## 5. Conceptos de Go que necesitas conocer

Go es muy distinto de Rust en superficie, pero también de TypeScript. Lo mínimo para moverte:

### Paquetes (`package`)

Cada archivo `.go` empieza con `package <nombre>`. Todos los archivos del mismo directorio comparten el mismo paquete. Importar un paquete es importar el directorio entero. Ejemplo: `import "github.com/14esc/aether-web/internal/domain/festivos"` da acceso a todo lo que `festivos/*.go` exporta.

**Exportar o no = mayúscula o minúscula.** `func Foo()` se exporta (público), `func foo()` no (privado al paquete). Lo mismo con structs y campos. Esto es radical: no hay `pub`/`public`.

### Structs

Son como `interface` en TypeScript o `struct` en Rust:

```go
type Festivo struct {
    FestivoSk     int32  `json:"festivo_sk"`
    FestivoDia    string `json:"festivo_dia"`
    FestivoMotivo string `json:"festivo_motivo"`
}
```

Las **etiquetas de campo** (los backticks ``` `json:"festivo_sk"` ```) le dicen a la librería de JSON cómo serializar ese campo. Si pones `*string` (puntero), un valor `nil` se serializa como `null`; si pones `string` y está vacío, se serializa como `""`.

### Errores

Go no tiene excepciones. Las funciones devuelven `(valor, error)`:

```go
items, err := h.svc.List(ctx)
if err != nil {
    return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
}
return c.JSON(http.StatusOK, items)
```

Idiomático: chequear `if err != nil` justo después de cada llamada. **Los errores son valores**, no se "lanzan".

### Interfaces y nada de herencia

Go no tiene clases ni herencia. Tiene interfaces *implícitas*: si un tipo tiene los métodos correctos, ya implementa la interfaz. No hace falta declararlo. En la práctica de este proyecto rara vez crearás interfaces nuevas; las que hay vienen de librerías (`echo.Context`, `pgxpool.Pool`, etc.).

### Punteros (`*T`)

Sí, Go tiene punteros, pero **sin aritmética** ni complicaciones de Rust. Solo significan "esto puede ser `nil`" o "esto se pasa por referencia para que la función pueda modificarlo". Verás `*float64`, `*int32`, etc., para representar columnas SQL nullables.

### Contexto (`ctx context.Context`)

Casi todas las funciones de IO reciben un `ctx` como primer parámetro. Sirve para cancelación: si el cliente HTTP corta la conexión, el contexto se cancela y la query a PostgreSQL aborta. Tú casi siempre te limitas a propagarlo: `c.Request().Context()` te da el contexto de la petición Echo.

### Cómo se organiza un dominio en este proyecto

Cada dominio tiene un archivo único `<dominio>.go` (cuando es pequeño) o varios archivos cuando crece. Contiene:

- **DTOs**: structs con `json:` tags. Son el contrato con el frontend.
- **Sentinel errors**: errores reutilizables como `ErrNotFound`, `ErrInvalidInput`, declarados al principio.
- **`Service`**: lógica de negocio. Recibe el pool y un `*queries.Queries` (las funciones generadas por sqlc).
- **`Handlers`**: funciones que reciben `echo.Context`, parsean el request, llaman al Service, devuelven el response.
- **`Register(g *echo.Group, authSvc *auth.Service)`**: el método que enchufa las rutas.

Patrón concreto:

```go
type Handlers struct{ svc *Service }
func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
    mw := auth.RequireAuth(authSvc)
    g.GET("/festivos", h.List, mw)
    g.POST("/festivos", h.Create, mw)
    g.PUT("/festivos/:id", h.Update, mw)
    g.DELETE("/festivos/:id", h.Delete, mw)
}
```

---

## 6. Pila del backend: PostgreSQL → sqlc → service → handlers → HTTP

Esta es la cadena de capas que recorre cada operación. Conviene tenerla muy clara.

### 6.1 Capa SQL (`queries/<dominio>.sql`)

Aquí escribes SQL "manual" con etiquetas que sqlc entiende:

```sql
-- name: ListFestivos :many
SELECT festivo_sk, festivo_dia, festivo_motivo
FROM detall.festivo
WHERE festivo_escuadrilla_fk = $1
ORDER BY festivo_dia;
```

Las etiquetas dicen:
- `name:` cómo se llamará la función Go generada (`ListFestivos`).
- `:many` que devuelve varias filas (otras: `:one`, `:exec`).
- `$1, $2, ...` son parámetros posicionales.

### 6.2 sqlc genera Go tipado

Cuando ejecutas `make sqlc` (que llama a `sqlc generate`), lee `queries/*.sql` y produce código Go en `internal/queries/`. **Ese código no se toca a mano**. Por cada query genera:

- Una constante con el SQL.
- Un struct `XxxParams` con los parámetros (si hay más de uno).
- Un struct `XxxRow` con los resultados (si hay más de una columna).
- Una función método del struct `Queries`.

Ejemplo de lo que genera para `ListFestivos`:

```go
// Generado automáticamente
func (q *Queries) ListFestivos(ctx context.Context, festivoEscuadrillaFk int32) ([]ListFestivosRow, error) { ... }
```

### 6.3 Service: lógica de negocio

El service envuelve las queries y compone la respuesta. Aquí van las validaciones que no son simples mapeos:

```go
func (s *Service) List(ctx context.Context, esc int32) ([]Festivo, error) {
    rows, err := s.q.ListFestivos(ctx, esc)
    if err != nil {
        return nil, err
    }
    out := make([]Festivo, 0, len(rows))
    for _, r := range rows {
        out = append(out, Festivo{
            FestivoSk:     r.FestivoSk,
            FestivoDia:    r.FestivoDia.Time.Format("2006-01-02"),
            FestivoMotivo: r.FestivoMotivo,
        })
    }
    return out, nil
}
```

### 6.4 Handlers: traducir HTTP a llamadas de service

El handler hace tres cosas: parsear el request, llamar al service, devolver el JSON correcto:

```go
func (h *Handlers) List(c echo.Context) error {
    user := auth.CurrentUser(c)
    if user == nil {
        return echo.NewHTTPError(http.StatusUnauthorized)
    }
    items, err := h.svc.List(c.Request().Context(), int32(user.EscuadrillaID))
    if err != nil {
        return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
    }
    return c.JSON(http.StatusOK, items)
}
```

### 6.5 Frontend: hooks que consumen el endpoint

En React, el hook `useApiQuery` hace el `fetch` por debajo:

```tsx
const { data: festivos } = useApiQuery<Festivo[]>(
    'GET', '/festivos', undefined,
    queryKeys.festivos.list(escId),
);
```

Esto cubre todo el ciclo: el usuario ve un componente → el componente llama al hook → el hook hace fetch → Go responde JSON → el componente se renderiza.

---

## 7. Walkthrough completo: el dominio "festivos"

Vamos a recorrer una feature pequeña de punta a punta para que veas las piezas juntas. Festivos es un CRUD trivial: días marcados como festivos por escuadrilla, mostrados en el calendario.

### 7.1 La tabla

Definida en `migrations/0001_init_schema.up.sql`:

```sql
CREATE TABLE detall.festivo (
    festivo_sk            SERIAL PRIMARY KEY,
    festivo_escuadrilla_fk INT NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    festivo_dia           DATE NOT NULL,
    festivo_motivo        VARCHAR(200) NOT NULL,
    UNIQUE (festivo_escuadrilla_fk, festivo_dia)
);
```

### 7.2 Queries SQL

`queries/festivos.sql` (37 líneas, un ejemplo de query por operación):

```sql
-- name: ListFestivos :many
SELECT festivo_sk, festivo_dia, festivo_motivo
FROM detall.festivo
WHERE festivo_escuadrilla_fk = $1
ORDER BY festivo_dia;

-- name: CreateFestivo :one
INSERT INTO detall.festivo (festivo_escuadrilla_fk, festivo_dia, festivo_motivo)
VALUES ($1, $2, $3)
RETURNING festivo_sk;

-- name: UpdateFestivo :execrows
UPDATE detall.festivo
SET festivo_dia = $1, festivo_motivo = $2
WHERE festivo_sk = $3 AND festivo_escuadrilla_fk = $4;

-- name: DeleteFestivo :execrows
DELETE FROM detall.festivo
WHERE festivo_sk = $1 AND festivo_escuadrilla_fk = $2;
```

Nota: la cláusula `AND festivo_escuadrilla_fk = $X` en UPDATE/DELETE es **RLS por código**. Aseguramos que un usuario solo puede modificar/borrar festivos de su escuadrilla.

### 7.3 sqlc genera

`internal/queries/festivos.sql.go` (autogenerado). No lo edites. Si tocas el `.sql`, lanza `make sqlc`.

### 7.4 Dominio Go

`internal/domain/festivos/festivos.go` reúne DTOs, service y handlers:

```go
// DTO de salida.
type Festivo struct {
    FestivoSk     int32  `json:"festivo_sk"`
    FestivoDia    string `json:"festivo_dia"`    // YYYY-MM-DD
    FestivoMotivo string `json:"festivo_motivo"`
}

// DTO de entrada para POST y PUT.
type WriteReq struct {
    FestivoDia    string `json:"festivo_dia"`
    FestivoMotivo string `json:"festivo_motivo"`
}

// Errores reusables.
var (
    ErrNotFound     = errors.New("festivo: not found")
    ErrDuplicate    = errors.New("festivo: duplicate festivo_dia")
    ErrInvalidInput = errors.New("festivo: invalid input")
)

// Service: lógica de negocio.
type Service struct {
    pool *pgxpool.Pool
    q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// Handlers: traducen HTTP ↔ Service.
type Handlers struct{ svc *Service }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
    mw := auth.RequireAuth(authSvc)
    g.GET("/festivos", h.List, mw)
    g.POST("/festivos", h.Create, mw)
    g.PUT("/festivos/:id", h.Update, mw)
    g.DELETE("/festivos/:id", h.Delete, mw)
}
```

### 7.5 Enchufado en `main.go`

```go
festivosHandlers := festivos.NewHandlers(festivos.NewService(pool))
festivosHandlers.Register(api, authSvc)
```

Sin estas dos líneas, la ruta no existe.

### 7.6 Frontend: el diálogo de festivos

`web/src/features/availability/components/dialogs/FestivosDialog.tsx` sigue la convención 5 (datos por TanStack Query, no `http()` + estado manual):

```tsx
const festivosKey = queryKeys.availability.festivos(escId ?? 0);

// Lectura: cachea bajo festivosKey, solo cuando el diálogo está abierto.
const { data: festivosData, isLoading } = useApiQuery<Festivo[]>(
    'GET', '/festivos', { enabled: open }, festivosKey,
);

// Escritura: al completarse invalida festivosKey → la lista se recarga sola.
const saveMutation = useApiMutation<unknown, { festivo_sk?: number; festivo_dia: string; festivo_motivo: string }>(
    mode === 'edit' ? 'PUT' : 'POST',
    (vars) => (mode === 'edit' ? `/festivos/${vars.festivo_sk}` : '/festivos'),
    { invalidateKeys: [festivosKey] },
);

const deleteMutation = useApiMutation<void, { festivo_sk: number }>(
    'DELETE',
    (vars) => `/festivos/${vars.festivo_sk}`,
    { invalidateKeys: [festivosKey] },
);
```

**El recorrido completo** del botón "Crear festivo":

1. El usuario rellena el formulario y pulsa "Guardar".
2. El handler llama `saveMutation.mutate({ festivo_dia, festivo_motivo })`.
3. `useApiMutation` usa `http` por debajo: añade la cookie de sesión y hace `fetch('/api/v1/festivos', ...)`.
4. Echo enruta a `Handlers.Create` (porque `Register` declaró `POST /festivos`).
5. El middleware `RequireAuth` lee la cookie, valida la sesión y mete el `User` en el contexto Echo.
6. El handler lee el body con `c.Bind(&req)`, llama a `svc.Create(...)`.
7. El service llama a `q.CreateFestivo(...)` (función generada por sqlc).
8. Postgres ejecuta el INSERT.
9. El service devuelve el ID.
10. El handler responde `201 Created` con `{ "id": 123 }`.
11. `invalidateKeys` invalida `festivosKey`: TanStack Query vuelve a pedir la lista y el diálogo se refresca solo.

---

## 8. Autenticación y sesiones

### Modelo

- **Login**: `POST /api/v1/auth/login` con `{ user, password }`. El backend valida con **argon2id** (algoritmo seguro de hashing de contraseñas) contra `detall.auth_user`.
- Si el password es válido, el backend genera un token aleatorio, guarda una sesión en `detall.auth_session` (con TTL configurable) y devuelve la cookie `aether_session` (HttpOnly, SameSite=Lax).
- **Cada request a `/api/v1/*` autenticado** lleva la cookie. El middleware `RequireAuth` la mira, busca la sesión en BD, y si está vigente carga el `User` en el contexto.
- **Logout**: `POST /api/v1/auth/logout`. Borra la sesión y limpia la cookie.
- **Rate limit en login**: por IP, ráfaga de 5 intentos y luego 1 cada 2 segundos (429 al excederse). Frena fuerza bruta de contraseñas.

### Autorización por nivel de permiso

Cada persona tiene un `person_permission_level`: `Común`, `Operacional`, `Administrativo` o `Seguridad`. **No es jerárquico**: cada ruta declara la lista de niveles admitidos (igual que hace el frontend con `hasPermission`). El middleware `auth.RequirePermission(niveles...)` se encadena tras `RequireAuth` en las rutas de escritura y devuelve **403** si el usuario no tiene un nivel admitido:

```go
operacional := auth.RequirePermission(auth.PermOperacional)
g.POST("/flights", h.Insert, mw, operacional)
```

Reparto actual (espejo del gating de la UI):

| Escrituras de…                                            | Niveles admitidos             |
|-----------------------------------------------------------|-------------------------------|
| Vuelos, papeletas, eventos, lookups de vuelo (aeronaves, lugares) | Operacional             |
| Personal, comisiones, festivos                             | Administrativo                |
| Ausencias, calificaciones (crew / not-crew)                | Operacional o Administrativo  |
| Todas las lecturas (GET)                                   | Cualquier usuario autenticado |

> El frontend oculta botones según el nivel, pero la garantía real está en el backend: un `curl` con sesión de nivel `Común` recibe 403 en cualquier escritura.

### Bootstrap inicial

El primer usuario admin se crea con la CLI `aether-bootstrap` (ver `cmd/bootstrap/main.go`). En producción, se ejecuta una sola vez con `sudo -u aether ./aether-bootstrap …`.

### Por qué cookie y no token Bearer

- Más simple para el frontend (el navegador la envía sola).
- `HttpOnly` impide que JavaScript la lea, mitigando XSS.
- `SameSite=Lax` mitiga CSRF para la mayoría de operaciones.

---

## 9. El frontend React

### Composición raíz (`web/src/app/App.tsx`)

```tsx
<ThemeProvider>                          ← light/dark mode
  <QueryClientProvider client={queryClient}>   ← TanStack Query (caché de queries)
    <UserProvider>                       ← Sesión + helpers (login, logout, useUser).
      <DatabaseProvider>                 ← Poll a /health para el indicador del sidebar.
        <TooltipProvider>
          <AppContent />                 ← Router + rutas.
          <Toaster />                    ← Notificaciones (sonner).
        </TooltipProvider>
      </DatabaseProvider>
    </UserProvider>
  </QueryClientProvider>
</ThemeProvider>
```

### Providers clave

- **`UserProvider`** (`web/src/providers/UserProvider.tsx`):
  - Estado: `id`, `userName`, `fullName`, `permissionLevel`, `escuadrillaId`, etc.
  - Acciones: `login(user, password)`, `logout()`, `refreshUser()`.
  - Hooks útiles: `useUser()`, `useUserData()`, `useIsAuthenticated()`, `useHasPermission(level)`, `useEscuadrilla()`.
  - Al montar, llama a `GET /auth/me` para restaurar la sesión si la cookie sigue válida.

- **`DatabaseProvider`** (`web/src/providers/DatabaseProvider.tsx`):
  - Llama a `GET /api/v1/health` cada `checkInterval` (configurado en `database/config.ts`).
  - Estados: `'connecting' | 'connected' | 'disconnected' | 'error'`.
  - Sirve solo para el icono de estado del sidebar (`ConnectionIndicatorSidebar.tsx`).

### Rutas (en `AppContent`)

```tsx
<Route path="/login" element={<LoginGate />} />
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="flights" element={<Flights />} />
    <Route path="personnel" element={<Personnel />} />
    {/* ... */}
  </Route>
</Route>
```

`ProtectedRoute` redirige a `/login` si `!isAuthenticated`. `LoginGate` hace lo contrario: si ya estás logueado y entras a `/login`, te redirige a `/`.

### Capa HTTP (`web/src/lib/http.ts`)

Un wrapper de `fetch` que:
- Prepende `/api/v1` al path.
- Pone `credentials: 'include'` (envía la cookie).
- Serializa body como JSON.
- Parsea respuesta JSON o text.
- Lanza `HttpError` con `status` y mensaje si la respuesta no es 2xx.

Ejemplo de uso "crudo":

```ts
import { http } from '@/lib/http';
const flight = await http<Flight>('GET', '/flights/123');
await http('POST', '/flights', { body: payload });
await http('DELETE', `/flights/${id}`);
```

### Capa de query (`web/src/lib/apiQuery.ts`)

Hooks tipados sobre TanStack Query:

| Hook                       | Para qué                                                    |
|----------------------------|-------------------------------------------------------------|
| `useApiQuery`              | Lecturas (GET o POST que devuelve JSON).                    |
| `useApiPaginatedQuery`     | Lecturas que responden `{ items: [...], total_count: N }`.  |
| `useApiMutation`           | Mutaciones (POST/PUT/DELETE) con invalidación de caché.     |
| `useLookupQuery`           | Lookups (`GET /lookups/:name`) con caché infinita.          |

---

## 10. Patrones repetidos en el frontend (lookups, queries, mutaciones)

### Lookup (lista de selectores)

```tsx
import { useAircrafts } from '@/shared/hooks';

function MyForm() {
    const { data: aircraftArray, loading, error, refetch } = useAircrafts();
    // aircraftArray: AircraftLookup[]
}
```

Bajo el capó, `useAircrafts` llama a `GET /api/v1/lookups/aircrafts`. La lista de hooks disponibles está en `web/src/shared/hooks/useLookups.ts` (uno por cada `case "..."` del switch del handler `lookups` en Go).

### Query paginada

```tsx
const { data: flights, totalCount, isLoading, refetch } = useApiPaginatedQuery<FlightData>({
    path: '/flights',
    query: { limit: 20, offset: 0 },
    queryKey: queryKeys.flights.list(escuadrillaId, { limit: 20, offset: 0 }),
    transform: transformFlightsFromDB,   // opcional
});
```

Backend devuelve `{ "items": [...], "total_count": N }`. El hook extrae `items` y lo expone como `data`.

### Mutación

```tsx
const deleteFlight = useApiMutation<void, { id: number }>(
    'DELETE',
    (vars) => `/flights/${vars.id}`,
    {
        invalidateKeys: [queryKeys.flights.all(escuadrillaId)],
        successMessage: 'Vuelo eliminado',
    },
);

deleteFlight.mutate({ id: 42 });
```

`invalidateKeys` hace que TanStack Query recargue automáticamente cualquier query cuya clave coincida con ese prefijo. Es como decir "después de borrar, vuelve a pedir la lista".

### Mutación inline (sin TanStack Query)

Para mutaciones simples que no necesitan invalidación de caché compleja, puedes llamar `http(...)` directamente:

```tsx
await http('POST', '/festivos', { body: { festivo_dia, festivo_motivo } });
await refetch();
```

### Convenciones de organización del frontend (2026-06)

Tras el refactor de los componentes grandes, el frontend sigue estas reglas.
**El código nuevo debe seguirlas también:**

1. **Componentes = solo render.** La lógica de datos, estado y handlers de una
   página o diálogo no trivial vive en un hook propio en
   `features/<feature>/hooks/use<Nombre>.ts`. El componente lo consume por
   destructuring y se limita al JSX. Ejemplos de referencia:
   - `availability/hooks/useAbsenceDialog.ts` ← `RegisterAbsenceDialog`
   - `availability/hooks/useDisponibilidad.ts` ← página `Disponibilidad`
   - `comisiones/hooks/useComisionForm.ts` ← `RegisterComisionForm`
   - `personnel/hooks/usePersonnel.ts` ← página `Personnel`
   - `ratings/hooks/useGeneralTacticalRatings.ts` ← `GeneralTacticalRatings`

2. **Modelo compartido por feature.** Tipos, catálogos y helpers que usan
   varios componentes de un feature van en un módulo de modelo, no dentro de
   un componente. Ejemplo: `availability/absences.ts` (tipos `Absence`/`Person`,
   catálogo `absenceReasonColors`, `getReasonColor`, helpers de fecha).

3. **Diálogos multi-tab → un archivo por tab.** Si un diálogo tiene secciones
   autocontenidas, cada una vive en su archivo bajo una subcarpeta del diálogo.
   Ejemplo: `flights/components/dialogs/manage-flight-data/{PlacesTab,AircraftsTab,EventsTab,shared}.tsx`.

4. **Tipos de la API: generados, no escritos a mano.** Los structs Go con tags
   `json:` son la fuente de verdad; tygo genera `web/src/types/generated/*.ts`
   (`make types`, y el CI falla si están desactualizados). Los archivos de
   `web/src/types/*.ts` son adaptadores finos que re-exportan los generados con
   los nombres históricos del frontend (ver `types/dashboard.ts` y
   `types/comisions.ts`); los tipos puramente de UI sí se escriben a mano ahí.
   **Nunca edites `types/generated/`.**

5. **Datos siempre por TanStack Query.** `useApiQuery` / `useApiMutation` /
   `useApiPaginatedQuery` con `queryKeys` e `invalidateKeys`; el patrón
   `http()` + `useState` + refetch manual está deprecado para queries (la
   mutación inline de arriba sigue siendo aceptable en casos triviales).
   `useApiPaginatedQuery` acepta un segundo genérico `TRaw` para tipar el
   `transform` con el tipo generado de la API (ver `Flights.tsx`).

---

## 11. Tareas típicas: cómo hacer X

Esta es la sección "recetario". Cuando no sepas por dónde empezar, busca aquí.

### A. Añadir un endpoint nuevo a un dominio existente

Ejemplo: "quiero un endpoint que devuelva festivos solo del próximo mes".

1. **Edita `queries/festivos.sql`** y añade la query nueva:
   ```sql
   -- name: NextMonthFestivos :many
   SELECT festivo_sk, festivo_dia, festivo_motivo
   FROM detall.festivo
   WHERE festivo_escuadrilla_fk = $1
     AND festivo_dia BETWEEN $2 AND $3
   ORDER BY festivo_dia;
   ```
2. Ejecuta `make sqlc`. Esto regenera `internal/queries/festivos.sql.go`.
3. **Añade el método al `Service`** en `internal/domain/festivos/festivos.go`:
   ```go
   func (s *Service) NextMonth(ctx context.Context, esc int32, from, to time.Time) ([]Festivo, error) {
       rows, err := s.q.NextMonthFestivos(ctx, queries.NextMonthFestivosParams{...})
       // ... mapear rows → []Festivo
   }
   ```
4. **Añade el handler** y registra la ruta:
   ```go
   func (h *Handlers) NextMonth(c echo.Context) error { /* ... */ }

   // En Register:
   g.GET("/festivos/next-month", h.NextMonth, mw)
   ```
5. Compila: `make build`. Si pasa, el endpoint existe.
6. **En el frontend**, crea o usa un hook:
   ```tsx
   const { data } = useApiQuery<Festivo[]>(
       'GET', '/festivos/next-month', undefined,
       queryKeys.festivos.nextMonth(escuadrillaId),
   );
   ```
   Probablemente tengas que añadir `nextMonth` a `queryKeys.festivos` en `web/src/lib/queryKeys.ts`.

### B. Añadir una columna nueva a una tabla

1. **Crea una migración nueva** con el siguiente número libre (mira el último en `migrations/`): `migrations/00NN_add_festivo_color.up.sql` con `ALTER TABLE detall.festivo ADD COLUMN festivo_color VARCHAR(7);`. Y la inversa en `00NN_..._down.sql` (`ALTER TABLE ... DROP COLUMN festivo_color;`).
2. Aplícala: `DATABASE_URL=... make migrate-up`.
3. **Actualiza las queries SQL** que SELECT-ean / INSERT-ean esa tabla para incluir la nueva columna (`queries/festivos.sql`).
4. `make sqlc` regenera el código.
5. **Actualiza los DTOs** del dominio Go (`Festivo`, `WriteReq`) para añadir el campo nuevo.
6. **Actualiza el frontend** para enviar/mostrar el nuevo campo.

> En producción la migración la aplica `deploy/migrate-up.sh` durante el `update.sh` automáticamente.

### C. Añadir un lookup nuevo

Por ejemplo, "necesito un selector de tipos de combustible".

1. **Si la fuente es una tabla** (lo más común), añade la query a `queries/lookups.sql`:
   ```sql
   -- name: FuelTypes :many
   SELECT fuel_type_sk, fuel_type_name FROM detall.fuel_type ORDER BY fuel_type_name;
   ```
2. `make sqlc`.
3. **Añade el DTO + método de service** en `internal/domain/lookups/dto.go` y `service.go`.
4. **Añade el `case`** en `internal/domain/lookups/handlers.go`:
   ```go
   case "fuel-types": data, err = h.svc.FuelTypes(ctx)
   ```
5. **Añade la entrada en `queryKeys.lookups`** en `web/src/lib/queryKeys.ts`.
6. **Añade el hook** en `web/src/shared/hooks/useLookups.ts`:
   ```tsx
   export function useFuelTypes() {
       return useLookup<FuelTypeLookup>('fuel-types', queryKeys.lookups.fuelTypes);
   }
   ```

### D. Arreglar un bug en un endpoint existente

1. Reproduce el bug con `curl` o desde la UI.
2. Mira los logs (`journalctl -u aether-web` en prod, o el stdout de `go run` en local).
3. Si el problema es la query SQL: edita `queries/<dominio>.sql`, `make sqlc`, vuelve a probar.
4. Si es lógica de service: edita el método correspondiente en `internal/domain/<dominio>/`.
5. Si es el handler: misma carpeta, función handler.
6. `make build` para verificar que compila. `make test` si hay tests.

### E. Añadir o cambiar texto/UI

Casi siempre toca solo `web/src/features/<feature>/`. Compila con `npm run build` (o el dev server `npm run dev`).

### F. Cambiar la duración de las sesiones

Cambia la variable de entorno `AETHER_SESSION_TTL` y reinicia el servicio. En producción está en `/etc/aether-web/env`. Acepta duración Go (`"12h"`, `"30m"`) o segundos (`"43200"`).

### G. Cambiar el puerto del servidor

Mismo mecanismo: `AETHER_ADDR=":9090"` y reinicio.

---

## 12. Desarrollo local

### Requisitos

- Go 1.22+
- Node 20+ y npm
- Docker (para PostgreSQL local)
- `sqlc` (`go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`)
- `migrate` (`go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`)

### Levantar PostgreSQL local

El contenedor de desarrollo se llama `aether-pg`. Una sesión típica:

```bash
docker start aether-pg          # si ya existe
# o, primera vez:
docker run -d --name aether-pg \
  -e POSTGRES_USER=aether_admin -e POSTGRES_PASSWORD=CHANGEME \
  -e POSTGRES_DB=aether \
  -p 5432:5432 postgres:18
```

### Aplicar migraciones (estructura + lookups + auth + triggers)

```bash
export DATABASE_URL="postgres://aether_admin:CHANGEME@127.0.0.1:5432/aether?sslmode=disable"
make migrate-up                  # aplica 0001-0004
```

> **Importante:** No aplicar 0005 todavía. Esa migración referencia
> personas (por `person_sk`) que solo existen tras cargar los datos del
> SQLite. Si `make migrate-up` aplica también 0005 antes, fallará por
> integridad referencial.

### Cargar los datos productivos desde SQLite (Aether-Tauri → Aether-Web)

La base de datos real estaba en SQLite. Para llevarla a PostgreSQL hay un
script Python (en `database-utils/`) que mapea los esquemas `dim_*`,
`fact_*`, `junction_*` de SQLite al esquema `detall.*`, `operations.*`,
`flightsafety.*` de PostgreSQL.

Copia el archivo `Aether.db` a `database-utils/` y ejecuta:

```bash
pip install -r database-utils/requirements.txt          # primera vez
python database-utils/migrationSQLiteToPostgres.py \
    --pg-dsn "$DATABASE_URL"
```

Por defecto el script busca `database-utils/Aether.db`. Si lo tienes en
otra ruta, pásalo con `--sqlite /otra/ruta/Aether.db`.

> Atajo equivalente: `make load-sqlite` (requiere `$DATABASE_URL`).

El script:

- Mapea rangos militares, especialidades y divisiones a las
  enumeraciones válidas (ver `*_MAPPING` en el script).
- Convierte timestamps Unix a `DATE`.
- Asigna `escuadrilla_fk = 14` por defecto (puedes cambiar el default).
- Preserva los SKs originales con `OVERRIDING SYSTEM VALUE` y resetea
  las secuencias al final.
- Salta `papeleta` y otras tablas si ya tienen datos
  (`skip_if_exists`), porque 0002 ya cargó las papeletas históricas.
- Valida los conteos origen/destino al terminar.

### Aplicar la migración 0005 (datos productivos)

Ahora que las personas existen, se pueden añadir las calificaciones,
horas previas, ausencias, comisiones y papeletas nuevas:

```bash
make migrate-up                  # aplica 0005
```

### Crear el primer usuario admin en local

Tras cargar SQLite ya existen 73 personas en `detall.person`. El
bootstrap **actualiza** la contraseña de una persona existente
(busca por `person_user`):

```bash
go run ./cmd/bootstrap --help    # ver opciones
# Ejemplo: poner contraseña a 'jon' (mapeado a person_sk = 66):
AETHER_DATABASE_URL="$DATABASE_URL" \
    go run ./cmd/bootstrap -user jon -password elige-una
```

> El mapeo `person_sk → person_user` está hardcodeado en
> `PERSON_USER_MAPPING` dentro del script Python. Si el usuario que
> buscas no aparece ahí, recibirá un username sintético
> (`user_<sk>`) que puedes cambiar luego en BD.

### Arrancar el backend

```bash
export AETHER_DATABASE_URL="$DATABASE_URL"
make run          # equivalente a `go run ./cmd/server`
```

Sirve en `:8080`. Como el frontend tiene su propio dev server, en desarrollo el binario sirve la SPA del último `npm run build`. Si tocas el frontend, lo normal es usar el dev server (siguiente paso).

### Arrancar el frontend en modo dev

```bash
cd web
npm install        # primera vez
npm run dev        # arranca Vite en :5173, proxea /api → :8080
```

Abre `http://localhost:5173`. Vite recarga en caliente al guardar archivos.

### Comandos `make` útiles

| Comando                 | Qué hace                                                    |
|-------------------------|-------------------------------------------------------------|
| `make run`              | Arranca el backend en local.                                |
| `make build`            | Build de debug del backend (Linux host).                    |
| `make sqlc`             | Regenera `internal/queries/*.sql.go`.                       |
| `make migrate-up`       | Aplica migraciones pendientes (usa `$DATABASE_URL`).        |
| `make migrate-down`     | Revierte la última migración.                               |
| `make load-sqlite`      | Carga datos desde `database-utils/Aether.db` a PostgreSQL.  |
| `make reload-sqlite`    | Reimporta SQLite tras truncar tablas (re-importación limpia). |
| `make db-reset`         | DROP + CREATE de la BD destino (mantiene el contenedor).    |
| `make dev-rebuild`      | **Ciclo completo de dev**: db-reset → migraciones → SQLite → admin. |
| `make test`             | Corre todos los tests Go.                                   |
| `make types`            | Regenera `web/src/types/generated/*.ts` desde los DTOs Go (tygo). |
| `make fmt`              | Formatea todo el código Go (gofmt).                         |
| `make vet`              | Linter ligero de Go.                                        |
| `make web-build`        | `npm ci && npm run build` (frontend → `web/dist/`).        |
| `make build-prod`       | Build de producción del backend con frontend embebido.      |
| `make dist`             | Genera tarball auto-contenido para desplegar.               |
| `make clean`            | Borra `bin/`, `dist/`, `web/dist/`.                         |

### Tests de integración

Los tests unitarios corren siempre con `make test`. Los de integración
(`internal/auth`, `internal/domain/festivos`) necesitan un servidor PostgreSQL
donde crear bases de datos efímeras; se activan con:

```bash
AETHER_TEST_DATABASE_URL="postgres://jon:1234@127.0.0.1:5432/aether?sslmode=disable" make test
```

Cada test crea una BD `aether_test_<aleatorio>`, aplica las migraciones
públicas (sin 0002/0005), siembra un catálogo mínimo (`internal/testdb`) y
la borra al terminar. Sin la variable, se saltan (skip). En CI corren contra
un service container de PostgreSQL.

### Ciclo de dev "desde cero"

Durante desarrollo es habitual cambiar el esquema (añadir columnas,
migraciones, etc.) y querer probar todo desde un estado limpio para
asegurar que en producción la primera instalación funcionará. Para eso:

```bash
export DATABASE_URL="postgres://aether_admin:CHANGEME@127.0.0.1:5432/aether?sslmode=disable"
make dev-rebuild
```

Hace en orden: **drop+create de la BD `aether`** dentro del contenedor
PostgreSQL → aplica migraciones 1..N (donde N = `SCHEMA_CUTOFF`,
por defecto 4) → carga las personas y vuelos del SQLite → aplica las
migraciones N+1 en adelante (las que dependen de personas) → setea
contraseña al admin de dev.

Variables sobrescribibles (todas tienen default):

| Variable | Default | Para qué |
|---|---|---|
| `PG_CONTAINER` | `aether-pg` | Nombre del contenedor Docker. |
| `PG_SUPERUSER` | `jon`       | Usuario administrativo del PostgreSQL. |
| `PG_TARGET_DB` | `aether`    | BD que se tira y recrea. |
| `SCHEMA_CUTOFF`| `4`         | Última migración que NO depende de personas. |
| `DEV_USER`     | `admin`     | Usuario al que se le pone contraseña tras cargar SQLite. |
| `DEV_PASSWORD` | `changeme`  | Contraseña de dev (NO usar en producción). |

Ejemplos:

```bash
make dev-rebuild DEV_PASSWORD=mi-pass-larga
make dev-rebuild SCHEMA_CUTOFF=6      # cuando añadas 0005/0006 al esquema
```

> Si necesitas resetear el **contenedor** PostgreSQL en sí (cambio de
> versión, datos persistidos corruptos), eso sigue siendo manual:
> `docker rm -f aether-pg && docker run -d --name aether-pg …`.
> Tras eso, vuelve a `make dev-rebuild`.

---

## 13. Estructura de repositorios (público + privado)

El proyecto se distribuye en **dos repositorios separados** en GitHub:

- **`aether-web`** (público, MIT) — todo el código: backend Go, frontend React, migraciones de esquema (0001, 0003, 0004), scripts genéricos, documentación, plantillas de ejemplo (`migrations/examples/`).
- **`aether-data`** (privado) — solo los archivos sensibles:
  - `Aether.db` — SQLite con datos personales de militares (nombres, DNIs, teléfonos, fechas de nacimiento).
  - `person_users.json` — mapeo `person_sk` → `person_user`.
  - `migrations/0002_seed_lookups.{up,down}.sql` — catálogo operativo de la escuadrilla (escuadrillas concretas, CAPBAs, papeletas históricas).
  - `migrations/0005_seed_productive_data.{up,down}.sql` — datos productivos (calificaciones reales, ausencias, comisiones).

### Por qué dos repos

1. **RGPD y confidencialidad**: el SQLite contiene datos personales de personas reales. No pueden estar en un repo público bajo ningún concepto, ni siquiera dentro del historial de git.
2. **Software libre real**: el código sigue siendo MIT y cualquiera puede usar la arquitectura, los handlers, el script de migración. Quien quiera correr la app contra otro dataset tiene las plantillas en `migrations/examples/*.sql.example` y `database-utils/person_users.example.json` para saber qué tablas hay que rellenar.
3. **Backup + multi-PC**: ambos repos en GitHub son tu copia de seguridad y se clonan idénticos en cualquier máquina.

### Cómo se conectan: symlinks

En lugar de duplicar archivos, los sensibles **viven en `~/aether-data/`** y `aether-web/` los referencia con symlinks. Editas el archivo donde sea (los symlinks son transparentes), el cambio queda en `~/aether-data/` y desde ahí lo commiteas al repo privado.

### Setup en una máquina nueva

```bash
# 1) Clonar ambos repos
git clone https://github.com/Navatante/aether-web
git clone https://github.com/Navatante/aether-data ~/aether-data

# 2) Symlinkar los archivos sensibles desde aether-data → aether-web
cd aether-web
ln -sf ~/aether-data/Aether.db                                         database-utils/Aether.db
ln -sf ~/aether-data/person_users.json                                 database-utils/person_users.json
# Los seeds son solo-up (no hay .down): dev hace drop+create y prod solo aplica `up`.
ln -sf ~/aether-data/migrations/0002_seed_lookups.up.sql               migrations/0002_seed_lookups.up.sql
ln -sf ~/aether-data/migrations/0005_seed_productive_data.up.sql       migrations/0005_seed_productive_data.up.sql

# 3) Lanzar el ciclo completo
make dev-rebuild PG_SUPERUSER=<tu_user> DEV_USER=<tu_user> DEV_PASSWORD=<tu_pass>
```

### Día a día — dónde commitea cada cambio

| Cambio | Commiteas desde | Push a |
|---|---|---|
| Código Go, React, scripts, migraciones de esquema (0001, 0003, 0004), docs | `aether-web/` | repo público |
| SQLite (`Aether.db`), papeletas históricas (0002), datos productivos (0005), mapeo de usuarios | `~/aether-data/` | repo privado |

Los symlinks hacen que editar `aether-web/migrations/0002_seed_lookups.up.sql` modifique de hecho el archivo en `~/aether-data/migrations/0002_seed_lookups.up.sql`. El cambio queda registrado en el repo privado, no en el público.

### Verificación antes de cada push al público

Pásate por `git status` desde `aether-web/` y verifica con tus ojos que **no aparecen**:

- `database-utils/Aether.db`
- `database-utils/person_users.json`
- `migrations/0002_seed_lookups.*.sql` (los sin `.example`)
- `migrations/0005_seed_productive_data.*.sql` (los sin `.example`)

Esos archivos están en `.gitignore` y deberían quedar ocultos automáticamente, pero un cambio inadvertido en `.gitignore` o un `git add -f` distraído puede colarlos. **Una vez en GitHub público, GitHub indexa rápido y no hay vuelta atrás limpia**: aunque borres el commit, los clones de terceros y los archivos cacheados por buscadores ya están fuera de tu control.

---

## 14. Despliegue en producción

El runbook completo está en `deploy/README.md`. Resumen muy abreviado:

1. En tu máquina de build: `make dist`. Esto genera `dist/aether-web-linux-amd64.tar.gz` (8 MB).
2. Copia el tarball al servidor y descomprímelo.
3. Primera vez: `sudo ./deploy/install.sh` y edita `/etc/aether-web/env`.
4. Aplica migraciones: `sudo /opt/aether-web/deploy/migrate-up.sh`.
5. Crea admin: `sudo -u aether /opt/aether-web/aether-bootstrap …`.
6. `sudo systemctl enable --now aether-web` y `curl http://127.0.0.1:8080/api/v1/health`.

Para actualizaciones posteriores: `sudo ./deploy/update.sh` desde el tarball nuevo. El script para → swap → migra → arranca → verifica health → revierte automáticamente si falla.

---

## 15. Diferencias deliberadas con la app Tauri original

| Tauri (antes)                                  | Web (ahora)                                                   |
|------------------------------------------------|---------------------------------------------------------------|
| Login por nombre de usuario de Windows         | Login con usuario + contraseña (argon2id en BD).             |
| Ventana sin decoración + botones min/max/close | Ventana del navegador. Sin botones propios.                  |
| Estado de conexión gestionado en el cliente    | Backend mantiene el pool; `/health` informa al cliente.      |
| Logs frontend + backend mezclados localmente   | Logs frontend → `POST /logs` → backend → journald.           |
| Distribución NSIS por puesto                   | Un binario en el servidor; usuarios entran por URL.          |
| `invoke('cmd', args)` desde React              | `http('METHOD', '/path', { body, query })` desde React.      |
| SQL Server                                     | PostgreSQL.                                                  |
| Stored procedures con lógica de negocio        | Lógica de negocio en Go (service); SQL solo lee/escribe.    |

**Bugs heredados ya corregidos tras la migración:**
- Los endpoints de calificaciones estaban intercambiados: `MaintenanceRatings.tsx` escribía en `/ratings/crew` (tabla de tripulantes) y `LeadershipRatings.tsx`/`GeneralTacticalRatings.tsx` en `/ratings/not-crew` (tabla de mantenimiento). Corregido en 2026-06: cada página escribe ahora en su tabla (`operations.crew_qualification` para tripulantes, `detall.notcrew_qualification` para mantenimiento). Se verificó que no había datos contaminados por el bug.

---

## 16. Glosario

- **Backend**: el servidor (en este caso, el binario Go). Recibe peticiones HTTP y responde.
- **Frontend**: el código que corre en el navegador (React + JavaScript).
- **API REST**: convención para diseñar endpoints HTTP usando los verbos GET/POST/PUT/DELETE sobre URLs que representan recursos.
- **Echo**: el framework HTTP de Go que usamos. Define rutas, middleware, parseo de requests.
- **pgx**: el driver Go para PostgreSQL. Soporta pool de conexiones y tipos avanzados.
- **sqlc**: generador que lee `queries/*.sql` con anotaciones y produce Go tipado. Te ahorra escribir ORM o reflexión.
- **TanStack Query** (antes React Query): librería para gestionar estado de servidor en React: caché, refetch, invalidación.
- **DTO**: Data Transfer Object. Un struct con campos que representa el JSON que va y viene.
- **Middleware**: función que envuelve un handler para hacer algo antes o después (auth, logging, parseo).
- **`go:embed`**: directiva de Go que mete archivos en el binario en tiempo de compilación. Aquí: la SPA.
- **systemd**: el gestor de servicios estándar de Linux moderno.
- **Cookie HttpOnly**: cookie que el JavaScript no puede leer. Solo el navegador la envía. Defensa contra XSS.
- **Argon2id**: algoritmo de hashing de contraseñas resistente a GPUs y a ataques de tiempo. Lo recomienda OWASP.
- **Pool de conexiones**: el binario mantiene N conexiones a PostgreSQL abiertas y las reutiliza, en vez de abrir una por request.
- **Migration**: cambio versionado del esquema de la BD. Las de esquema tienen `.up.sql` (aplicar) y `.down.sql` (revertir); las de seed (0002, 0005) son solo-up.
- **SPA**: Single Page Application. El navegador descarga un único `index.html` + JS y navega sin recargar la página.
- **RLS** (Row-Level Security): aquí lo aplicamos a mano en cada query con `WHERE escuadrilla_fk = $X`. El concepto: cada usuario solo ve filas de su escuadrilla.
- **Sub-lote**: porción de trabajo dentro de un hito. La migración del frontend (Hito 5) se dividió en 8 sub-lotes por feature.
