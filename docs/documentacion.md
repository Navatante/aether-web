# Aether-Web — Manual de estudio

> **Cómo se relaciona con el resto de docs.** `docs/ARQUITECTURA.md` es la guía **de referencia y operativa** (cómo arranca el binario, recetas de "cómo añado X", despliegue, glosario). Este `documentacion.md` es el **manual didáctico**: explica *por qué* del stack y recorre el código directorio por directorio enseñando los patrones. Cuando una tarea operativa concreta esté mejor cubierta allí, lo indico, pero no necesitas abrirla para seguir este texto.

---

## Índice

- [Parte 0. Cómo usar este documento y el mapa del repo](#parte-0-cómo-usar-este-documento-y-el-mapa-del-repo)
- [Parte 1. Go para quien viene de Java](#parte-1-go-para-quien-viene-de-java)
- [Parte 2. TypeScript y React para quien viene de Java](#parte-2-typescript-y-react-para-quien-viene-de-java)
- [Parte 3. La arquitectura en una imagen](#parte-3-la-arquitectura-en-una-imagen)
- [Parte 4. Recorrido del backend, directorio por directorio](#parte-4-recorrido-del-backend-directorio-por-directorio)
- [Parte 5. Recorrido del frontend, directorio por directorio](#parte-5-recorrido-del-frontend-directorio-por-directorio)
- [Parte 6. Flujos completos de punta a punta](#parte-6-flujos-completos-de-punta-a-punta)
- [Parte 7. Build, herramientas y generación de código](#parte-7-build-herramientas-y-generación-de-código)
- [Parte 8. Glosario](#parte-8-glosario)

---

## Parte 0. Cómo usar este documento y el mapa del repo

### Qué es Aether-Web

Una aplicación de **gestión de operaciones de vuelo** de una escuadrilla de helicópteros: registra vuelos y sus horas, calificaciones de tripulantes, papeletas de instrucción, ausencias, comisiones de servicio y suministro de combustible. Sustituye a una app de escritorio anterior (Tauri + SQL Server). Es **cliente-servidor de intranet**, pensada para correr en la red local de una unidad, no en internet público.

Técnicamente son **dos mitades** que viajan en **un solo binario**:

- **Backend en Go**: un servidor HTTP (framework Echo) que habla con **PostgreSQL** mediante **pgx** y consultas SQL generadas con **sqlc**.
- **Frontend en React** (SPA — *Single Page Application*): construido con Vite, TanStack Query, Radix y Tailwind. En producción se **incrusta dentro del binario Go** (`go:embed`), de modo que despliegas un único ejecutable que sirve la API *y* la web.

### Cómo leer este manual

El recorrido tiene una progresión deliberada:

1. **Partes 1 y 2** te dan los **fundamentos del lenguaje/framework** (Go primero, TS/React después) con ejemplos sacados de este propio repo. Si nunca has tocado Go o React, empieza aquí.
2. **Parte 3** te da la **foto global**: cómo encajan las piezas y cómo viaja un request de punta a punta.
3. **Partes 4 y 5** son el **recorrido por directorios**. Cada carpeta sigue el mismo molde: *propósito → conceptos nuevos → deep-dive de un archivo representativo → tabla "archivo → rol"*. Las tablas garantizan que ningún archivo quede sin ubicar aunque no lo expliquemos línea a línea.
4. **Parte 6** **ata las dos mitades** con flujos reales (una lectura, una escritura, el login).
5. **Parte 7** explica el **tooling** (sqlc, tygo, Vite, embed, CI) y la **Parte 8** es un glosario de consulta rápida.

### Mapa de la documentación del repositorio

| Documento | Qué es | Cuándo acudir |
|---|---|---|
| `docs/documentacion.md` (este) | Manual didáctico, autónomo, de Java a Go/React. | Para **aprender** el proyecto y sus patrones. |
| `docs/ARQUITECTURA.md` | Guía de referencia/operativa (arranque, recetas, despliegue, glosario extenso). | Para **hacer una tarea concreta** ya catalogada. |
| `README.md` | Pitch del proyecto, seguridad, arranque rápido, privacidad/RGPD. | Visión de 1 minuto y puesta en marcha. |
| `CLAUDE.md` (raíz) | Reglas y convenciones canónicas del repo. | Las **reglas duras** (permisos, errores, RGPD, migraciones). |
| `web/CLAUDE.md` | Detalle operativo del frontend (hooks, queryKeys, tablas, theming). | Recetas de frontend. |
| `migrations/README.md` | Convenciones de migraciones y qué archivos son symlinks privados. | Tocar el esquema de BD. |
| `deploy/README.md` | Runbook de producción (systemd, install/update con rollback). | Desplegar. |

### Vocabulario mínimo del dominio (para no perderte)

- **Escuadrilla**: la unidad. Cada dato "productivo" pertenece a una escuadrilla; el backend **aísla** los datos por escuadrilla (ver RLS por código en la Parte 3).
- **Papeleta**: una ficha/sesión de instrucción de vuelo.
- **Comisión**: una comisión de servicio (desplazamiento) de personal, con sus días.
- **Calificación (rating)**: nivel/aptitud de un tripulante en distintas categorías (modelo, operacional, táctica general, liderazgo, mantenimiento).
- **Esfuerzo**: métrica agregada de actividad (horas) en un periodo.
- **DV**: tripulante de "dotación de vuelo" no piloto (ej. operadores). **Cupo**: reparto de horas por autoridad. Glosario completo en la [Parte 8](#parte-8-glosario).

---

## Parte 1. Go para quien viene de Java

Go es un lenguaje compilado, con recolector de basura y tipado estático, igual que Java en esos tres puntos. Pero su **filosofía es opuesta** en muchas cosas: no hay clases ni herencia, los errores no son excepciones sino valores que devuelves, y la concurrencia es de primera clase. Esta parte te da exactamente lo que necesitas para leer **este** código con soltura.

### 1.1 Paquetes (`package`) y módulos

En Java organizas en `package com.empresa.proyecto` y un `.java` por clase pública. En Go:

- Cada **directorio** es **un paquete**. Todos los `.go` de una carpeta comparten el mismo `package x` (la primera línea del fichero) y se ven entre sí **sin importar nada** — no hay `import` entre ficheros del mismo paquete. Por eso el dominio `festivos` reparte structs, lógica y handlers en un único `festivos.go` sin ceremonia, y los grandes los reparten en `dto.go`/`service.go`/`handlers.go` que **siguen siendo el mismo paquete**.
- La **visibilidad** no se declara con `public`/`private`: se decide por la **mayúscula inicial del identificador**. `Service` (mayúscula) es exportado (visible desde otros paquetes); `setAuditGUCs` (minúscula) es privado al paquete. Esto aplica a tipos, funciones, métodos y campos de struct.
- El **módulo** se declara en `go.mod`. Aquí: `module github.com/14esc/aether-web` y `go 1.25.0`. Los imports usan esa ruta: `github.com/14esc/aether-web/internal/auth`. La carpeta especial **`internal/`** es una regla del compilador: solo el propio módulo puede importar lo que cuelga de `internal/`. Es el equivalente Go a "este código es interno, no es API pública".

```go
// cmd/server/main.go
import (
    "github.com/14esc/aether-web/internal/auth"
    "github.com/14esc/aether-web/internal/domain/festivos"
)
```

> **Equivalente Java.** El paquete Go ≈ un paquete Java, pero con granularidad de **carpeta** (no de fichero) y con visibilidad por mayúscula en vez de modificadores. `internal/` ≈ módulos de Java (JPMS) que no exportan un paquete.

### 1.2 Sin clases: `struct` + métodos con receptor

Go no tiene clases. Tiene **structs** (agrupaciones de campos, como un POJO sin métodos dentro) y **métodos** que se declaran *fuera* del struct, asociados mediante un **receptor**.

```go
// internal/domain/festivos/festivos.go
type Service struct {
    pool *pgxpool.Pool
    q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

func (s *Service) List(ctx context.Context) ([]Festivo, error) {
    rows, err := s.q.ListFestivos(ctx)
    // ...
}
```

Léelo así:

- `type Service struct { ... }` declara la estructura de datos (como los campos de una clase Java).
- `func (s *Service) List(...)` es un **método** de `Service`. El `(s *Service)` antes del nombre es el **receptor**: el equivalente a `this`, pero explícito y con nombre que eliges tú (aquí `s`). `*Service` significa que el receptor es un **puntero** (ver 1.4).
- No hay constructores como en Java. La convención es una **función `NewXxx`** que crea y devuelve el valor ya inicializado. `NewService(pool)` ≈ `new Service(pool)`.

> **Equivalente Java.** `struct` ≈ los campos de una clase; los métodos con receptor ≈ los métodos de instancia, pero escritos aparte; `NewService` ≈ un constructor o una *factory*. No hay `static` ni `this` implícito.

### 1.3 Interfaces implícitas y composición (en vez de herencia)

Aquí está la diferencia conceptual más grande con Java. En Java declaras `class Foo implements Bar`. En Go **no se declara** que un tipo implemente una interfaz: si un tipo tiene los métodos que la interfaz pide, **ya la implementa**, automáticamente. Es *duck typing* verificado en compilación.

Lo ves en `internal/queries/db.go`, donde sqlc define qué necesita para hablar con la BD:

```go
// internal/queries/db.go
type DBTX interface {
    Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
    Query(context.Context, string, ...interface{}) (pgx.Rows, error)
    QueryRow(context.Context, string, ...interface{}) pgx.Row
}

func New(db DBTX) *Queries { return &Queries{db: db} }
```

`DBTX` es una interfaz con tres métodos. **Ni el pool (`*pgxpool.Pool`) ni una transacción (`pgx.Tx`) declaran `implements DBTX`**, pero ambos tienen esos tres métodos, así que ambos *encajan*. Por eso este patrón funciona sin tocar nada:

```go
q := queries.New(s.pool)  // queries sobre el pool (autocommit, una conexión por llamada)
// ...
tx, _ := s.pool.Begin(ctx)
q := queries.New(tx)      // las MISMAS queries, ahora dentro de una transacción
```

El truco lo usa `flights` para su insert transaccional: pasa la **transacción** a `queries.New(tx)` y todas las inserciones de las ~12 tablas hijas ocurren atómicamente. Mismo código generado, distinto "ejecutor".

Go favorece la **composición** sobre la herencia: en vez de extender clases, **embebes** structs o **inyectas** dependencias (como el `pool` que entra por `NewService`). No hay `extends`.

> **Equivalente Java.** La interfaz Go ≈ una interfaz Java, pero el `implements` es **implícito**. Esto invierte la dependencia: la interfaz la define **quien consume** (sqlc define `DBTX` con lo mínimo que necesita), no quien implementa. Es lo que en Java conseguirías con interfaces muy pequeñas + adaptadores, pero aquí sale gratis.

### 1.4 Punteros (`*T`, `&`) y valores cero

Go tiene punteros, pero mucho más domados que C. Solo necesitas entender tres cosas para leer este repo:

- `*T` es "puntero a un valor de tipo `T`". `*Service` = "puntero a Service".
- `&x` toma la **dirección** de `x` (crea un puntero hacia él). `&Service{pool: pool}` crea un `Service` y devuelve su puntero.
- Cuando una función recibe un valor **por copia** vs **por puntero** importa: con puntero, los cambios se ven fuera y no se copia toda la estructura. Por eso los métodos usan receptor `*Service` (un único Service compartido) y por eso `User` se pasa como `*User` (para distinguir "no hay usuario" con `nil`).

El **valor cero**: en Go toda variable declarada sin inicializar tiene un valor por defecto bien definido — `0` para números, `""` para strings, `false` para bool, y **`nil`** para punteros, slices, maps e interfaces. No existe el "null no inicializado" sorpresa de Java: el valor cero es intencional y se usa mucho.

```go
// internal/auth/middleware.go
func CurrentUser(c echo.Context) *User {
    if v, ok := c.Get(ctxUserKey).(*User); ok {
        return v
    }
    return nil   // "no hay usuario": un *User nil
}
```

Fíjate en `v, ok := ...(*User)`: es un **type assertion** ("intenta interpretar esto como `*User`"). Devuelve **dos valores**: el valor y un booleano `ok` de si funcionó. Devolver varios valores es idiomático en Go (lo verás constantemente con `value, err`).

> **Equivalente Java.** Un `*User` que puede ser `nil` ≈ una referencia Java que puede ser `null`, pero en Go la distinción "puntero vs valor" es explícita y deliberada. El "valor cero" es como si cada tipo tuviera un default garantizado y útil.

### 1.5 Errores como valores (no excepciones)

**Esto cambia cómo se lee todo el backend.** Go no tiene `try/catch`. Una función que puede fallar **devuelve un `error` como último valor de retorno**, y quien la llama **debe** comprobarlo. De ahí el `if err != nil` omnipresente.

```go
// internal/db/pool.go
pool, err := pgxpool.NewWithConfig(ctx, pcfg)
if err != nil {
    return nil, fmt.Errorf("create pool: %w", err)
}
```

Patrones que verás por todo el repo:

- **`if err != nil { return ..., err }`**: propagar el error hacia arriba. Es la "pila" manual frente al *stack unwinding* de las excepciones Java.
- **Envolver con contexto**: `fmt.Errorf("create pool: %w", err)`. El verbo `%w` "envuelve" el error original conservándolo; el texto añade dónde pasó. Es como encadenar causas (`new IOException("...", cause)` en Java) pero con strings.
- **Sentinel errors**: errores predefinidos como valores con nombre, para poder distinguirlos:

```go
// internal/domain/festivos/festivos.go
var (
    ErrNotFound     = errors.New("festivos: not found")
    ErrInvalidInput = errors.New("festivos: invalid input")
    ErrDateInUse    = errors.New("festivos: already exists on that date")
)
```

- **`errors.Is(err, ErrNotFound)`**: comprueba si un error (posiblemente envuelto) "es" un sentinel concreto. Es el equivalente a `catch (NotFoundException e)`, pero con valores:

```go
// internal/domain/festivos/festivos.go (handler Create)
switch {
case errors.Is(err, ErrInvalidInput):
    return echo.NewHTTPError(http.StatusBadRequest, err.Error())
case errors.Is(err, ErrDateInUse):
    return echo.NewHTTPError(http.StatusConflict, err.Error())
case err != nil:
    return err   // error inesperado: se propaga "crudo"
}
```

Este patrón es **el contrato de errores de todo el proyecto** (lo formaliza el `CLAUDE.md`): los errores **esperables** (validación, not-found, duplicado) se convierten en un `echo.NewHTTPError(4xx, mensajeSeguro)`; cualquier **otro** error se devuelve **sin envolver** (`return err`) y un handler central lo loguea y responde un 500 genérico — para no filtrar detalles de SQL/esquema al navegador. Lo veremos en `internal/httpx/errors.go` (Parte 4).

> **Equivalente Java.** El `error` de Go ≈ una excepción *checked* que el compilador casi te obliga a tratar, pero que viaja como un **valor de retorno** en vez de propagarse sola. `errors.Is` ≈ `instanceof`/`catch` por tipo. `%w` ≈ la causa encadenada.

### 1.6 `defer`: limpieza garantizada

`defer` aplaza una llamada hasta que la función **retorne** (pase lo que pase, incluido un return temprano). Es el "limpiador" idiomático de Go.

```go
// internal/domain/flights/service.go (Insert)
tx, err := s.pool.Begin(ctx)
if err != nil { return InsertResult{}, err }
defer tx.Rollback(ctx) //nolint:errcheck   // si no hubo Commit, hace rollback
```

El `defer tx.Rollback(ctx)` garantiza que, si la función sale por cualquier error antes del `Commit`, la transacción se deshace. Si el `Commit` sí ocurre, el rollback posterior es un no-op. Lo verás también como `defer pool.Close()`, `defer rows.Close()`, `defer cancel()`.

> **Equivalente Java.** `defer` ≈ un bloque `finally`, pero a nivel de sentencia y apilable (varios `defer` se ejecutan en orden LIFO). Cubre el rol de try-with-resources.

### 1.7 Slices y maps

- **Slice** `[]T`: lista dinámica de elementos de tipo `T` (≈ `ArrayList<T>`/array que crece). `make([]Festivo, 0, len(rows))` crea un slice vacío con **capacidad** reservada para `len(rows)` (optimización, como dimensionar un `ArrayList`). Se añade con `append`:

```go
out := make([]Festivo, 0, len(rows))
for _, r := range rows {
    out = append(out, Festivo{ FestivoSk: r.FestivoSk, /* ... */ })
}
return out
```

- **`range`** itera: `for i, v := range slice` da índice y valor; `for _, v := range slice` ignora el índice con el **blank identifier `_`** (descarta valores que no usas — Go no te deja tener variables sin usar).
- **Map** `map[K]V`: diccionario (≈ `HashMap<K,V>`). Aquí se usa como *set* en `RequirePermission`:

```go
// internal/auth/middleware.go
allowed := make(map[string]struct{}, len(levels))
for _, l := range levels { allowed[l] = struct{}{} }
// ...
if _, ok := allowed[user.PermissionLevel]; !ok { /* 403 */ }
```

`struct{}` es un struct vacío que ocupa 0 bytes: `map[string]struct{}` es el modismo Go para un `HashSet<String>`. El `_, ok := map[k]` comprueba presencia sin usar el valor.

### 1.8 `context.Context`: cancelación y deadlines

Verás `ctx context.Context` como **primer parámetro** de casi todas las funciones del backend. Es el mecanismo estándar de Go para **propagar cancelación, deadlines y valores de petición** por la pila de llamadas. Cuando el cliente cierra la conexión o salta un timeout, el `ctx` se "cancela" y las operaciones que lo respetan (las queries pgx) abortan en vez de seguir trabajando para nadie.

```go
// internal/db/pool.go
pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
if err := pool.Ping(pingCtx); err != nil { /* ... */ }
```

`context.WithTimeout` deriva un contexto que se auto-cancela a los 5 s; `cancel` se llama con `defer` para liberar recursos. En Echo, `c.Request().Context()` te da el contexto de la petición HTTP, que los handlers pasan al service y este a las queries: una cadena de cancelación de punta a punta.

> **Equivalente Java.** No hay un equivalente exacto en Java estándar; piensa en una mezcla de `Future.cancel()` + un *deadline* + un `ThreadLocal` de petición, pero **explícito** y pasado a mano.

### 1.9 Goroutines, channels y `select`

La concurrencia es nativa en Go. Una **goroutine** es un hilo ligerísimo: lanzas una con `go funcion()`. Un **channel** (`chan T`) es una tubería tipada para comunicar goroutines. `select` espera en varios channels a la vez. Aquí está el ejemplo real del **apagado ordenado** del servidor:

```go
// cmd/server/main.go (run)
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
// ...
go purgeSessionsLoop(ctx, logger, authSvc)   // job en segundo plano

errCh := make(chan error, 1)
go func() {                                  // el servidor HTTP en su goroutine
    if err := e.Start(cfg.Addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
        errCh <- err
    }
}()

select {
case err := <-errCh:          // el servidor murió por un error real
    return err
case <-ctx.Done():            // llegó SIGINT/SIGTERM: apagar con gracia
    shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
    defer cancel()
    return e.Shutdown(shutdownCtx)
}
```

Léelo así: `main` arranca el servidor en una goroutine y se **bloquea** en el `select` esperando lo que ocurra primero — o un error del servidor, o una señal del sistema operativo (`Ctrl-C`, `systemctl stop`). Si llega la señal, `ctx.Done()` se "activa" y se hace un `Shutdown` que deja terminar las peticiones en curso (hasta `shutdownTimeout`). El job periódico `purgeSessionsLoop` es otra goroutine que limpia sesiones caducadas con un `ticker`:

```go
// cmd/server/main.go
func purgeSessionsLoop(ctx context.Context, logger *slog.Logger, svc *auth.Service) {
    ticker := time.NewTicker(sessionPurgeInterval)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():   return          // el server se apaga → termina el job
        case <-ticker.C:     /* purga */
        }
    }
}
```

> **Equivalente Java.** `go f()` ≈ enviar una tarea a un executor, pero baratísimo (puedes tener millones). Un `chan` ≈ un `BlockingQueue` tipado. `select` ≈ esperar en varios `Future`/colas a la vez. El patrón `ctx.Done()` ≈ un `volatile boolean running` + interrupción, pero estándar y componible.

### 1.10 `go:embed`: meter ficheros en el binario

Una directiva mágica en comentario que **incrusta ficheros en el ejecutable** en tiempo de compilación. Así viaja el frontend dentro del binario Go:

```go
// web/embed.go
//go:embed all:dist
var distFS embed.FS

func DistFS() (fs.FS, error) { return fs.Sub(distFS, "dist") }
```

`//go:embed all:dist` mete **toda** la carpeta `web/dist/` (el build de React) dentro de la variable `distFS`. En producción no hay ficheros sueltos que servir: el binario **es** el servidor web. (`all:` incluye también ficheros que empiezan por `.` o `_`.)

> **Equivalente Java.** ≈ empaquetar recursos estáticos dentro del JAR y leerlos del classpath, pero sin classloader: es un `fs.FS` (sistema de ficheros virtual) en memoria.

### 1.11 Cómo se organiza un dominio (el patrón que se repite 12 veces)

Cada "dominio" del backend (festivos, flights, comisiones, ratings...) es un paquete bajo `internal/domain/<dominio>/` con **tres piezas**, junten un fichero o tres:

1. **DTOs** — structs que definen el **contrato JSON** con el frontend. Las **etiquetas de struct** (`json:"festivo_dia"`) le dicen al serializador cómo nombrar cada campo en el JSON:

   ```go
   type Festivo struct {
       FestivoSk     int32  `json:"festivo_sk"`
       FestivoDia    string `json:"festivo_dia"`
       FestivoMotivo string `json:"festivo_motivo"`
   }
   ```

2. **Service** — la lógica de negocio + los sentinel errors. Recibe el `pool`, valida, llama a las queries generadas, transforma filas de BD en DTOs.

3. **Handlers** — traducen HTTP ↔ service: parsean el body/params, llaman al service, mapean sentinel errors a códigos HTTP, y registran las rutas en `Register(g, authSvc)`.

Los dominios **pequeños** (festivos, events, esfuerzo...) meten las tres piezas en un único `<dominio>.go`. Los **grandes** (flights, comisiones, ratings, lookups, dashboard) las separan en `dto.go` / `service.go` / `handlers.go`. **Mismas piezas, distinta granularidad de fichero.** Internalizar este molde es la clave para leer cualquier dominio en 2 minutos.

---

## Parte 3. La arquitectura en una imagen

> (La Parte 2, sobre TypeScript/React, va después del recorrido de backend para no romper el hilo; si vienes a leer frontend, salta a ella.)

### Las capas, de la base de datos al navegador

Aether-Web es una cadena de capas muy regular. Un dato sube desde PostgreSQL hasta un componente React atravesando siempre las mismas estaciones:

```
PostgreSQL
   │  (SQL escrito a mano en queries/<dominio>.sql)
   ▼
sqlc  ──genera──▶  internal/queries/   (funciones Go tipadas: q.ListFestivos(ctx) ...)
   ▼
Service  (internal/domain/<dominio>/service.go)   ← lógica de negocio, valida, transforma a DTO
   ▼
Handlers (internal/domain/<dominio>/handlers.go)  ← HTTP: parsea, llama al service, mapea errores
   ▼
Echo  (router HTTP) ──── responde JSON ───┐
   ▲                                       │
   │  go:embed sirve la SPA                ▼  /api/v1/...
   │                              ┌─────────────────────┐
   └──────────────────────────────│  NAVEGADOR (React)  │
                                  └─────────────────────┘
   http.ts        ── wrapper fetch, prepende /api/v1
   apiQuery.ts    ── TanStack Query: caché, estados, invalidación
   features/...   ── hooks (lógica) + componentes (render)
```

Y en sentido contrario, una **escritura** (crear un festivo) baja: componente → hook de mutación → `http.ts` → Echo → handler (comprueba permiso) → service (valida) → query generada → INSERT en PostgreSQL.

### El contrato de tipos Go → TypeScript

Una decisión clave: **los structs Go son la única fuente de verdad de los tipos**. La herramienta **tygo** lee los DTOs Go y **genera** los tipos TypeScript en `web/src/types/generated/`. El frontend no redefine los contratos a mano: los importa generados. Si cambias un DTO en Go y no regeneras (`make types`), **el CI falla**. Esto elimina la clase entera de bugs "el back y el front no se ponen de acuerdo en la forma del JSON".

### Aislamiento por escuadrilla (RLS "por código")

Los datos productivos pertenecen a una escuadrilla. En vez de usar Row-Level Security de PostgreSQL, el aislamiento se hace **en el código**: las queries de datos por escuadrilla **siempre** filtran por la columna `*_escuadrilla_fk`, usando el `EscuadrillaID` que viaja en la sesión del usuario. Lo ves en `flights`: el handler saca `u.EscuadrillaID` del usuario autenticado y el service lo pasa a la query como filtro. En el frontend, ese mismo `escuadrillaId` entra en **todas las claves de caché** de TanStack Query, para que la caché de un usuario nunca muestre datos de otra escuadrilla.

### Permisos: allow-list exacta, sin jerarquía

Hay cuatro niveles de permiso: `Común`, `Operacional`, `Administrativo`, `Seguridad`. **No hay jerarquía**: "Administrativo" **no** incluye "Operacional". Cada ruta de escritura declara qué niveles concretos admite, mediante un middleware `RequirePermission(...)`. La UI también oculta botones según el permiso, pero eso es **cosmético**: la garantía real es el **403 del backend**. Detalle en la Parte 4 (`internal/auth`).

### Un request de punta a punta (resumen)

1. El navegador hace `GET /api/v1/festivos` (con la cookie de sesión).
2. Echo pasa el request por los **middlewares**: recuperación de pánico, request-id, logging, límite de body, y para esta ruta `RequireAuth` (valida la sesión y mete el `User` en el contexto).
3. El **handler** `festivos.List` llama al **service**.
4. El **service** llama a `q.ListFestivos(ctx)` (función **generada por sqlc**), que ejecuta el SQL sobre el **pool** pgx.
5. El service convierte las filas en `[]Festivo` (DTO) y el handler responde `200` con JSON.
6. En el navegador, **TanStack Query** cachea la respuesta bajo una clave; el componente la pinta. Si luego se crea un festivo, la **mutación invalida** esa clave y la lista se refresca sola.

---

## Parte 4. Recorrido del backend, directorio por directorio

Molde de cada sección: **propósito → conceptos nuevos → deep-dive → tabla "archivo → rol"**.

### 4.1 `cmd/` — los puntos de entrada (`func main`)

**Propósito.** En Go, un ejecutable es un paquete `main` con una función `main()`. La convención es ponerlos bajo `cmd/<nombre>/`. Hay dos binarios:

- `cmd/server/` — el **servidor** (el que despliegas).
- `cmd/bootstrap/` — una **utilidad CLI** para fijar la contraseña de un usuario (alta del primer admin).

**Deep-dive: `cmd/server/main.go`.** Es la **composición raíz** de toda la aplicación (lo que en Spring sería el arranque del contexto). Su `run(logger)` hace, en orden:

1. **Carga y valida la configuración** (`config.Load()`). Si falta el DSN, **no arranca**.
2. **Crea el contexto de apagado** ligado a señales del SO (`signal.NotifyContext`, ver Parte 1.9).
3. **Abre el pool** de PostgreSQL (`db.New`) y agenda su cierre con `defer pool.Close()`.
4. **Construye los servicios y handlers** de cada dominio, todos inyectando el mismo `pool`:

   ```go
   authSvc := auth.NewService(pool, cfg.SessionTTL)
   festivosHandlers := festivos.NewHandlers(festivos.NewService(pool))
   // ... uno por dominio
   ```

5. **Crea Echo**, configura la **extracción de IP** (importante para auditoría: por defecto usa la IP de la conexión TCP e **ignora** `X-Forwarded-For` salvo que `AETHER_TRUSTED_PROXY=true`), instala el **handler central de errores** y la cadena de **middlewares globales** (`Recover`, `RequestID`, logger, `BodyLimit("2M")`).
6. **Registra las rutas** bajo el grupo `/api/v1`. **Aquí está la "tabla de enchufado"**: cada dominio expone su `Register(api, authSvc)` y se llama explícitamente. *Si un dominio no se enchufa aquí, sus rutas no existen* — no hay descubrimiento automático.

   ```go
   api := e.Group("/api/v1")
   api.GET("/health", healthHandler(pool))
   authHandlers.Register(api)
   festivosHandlers.Register(api, authSvc)
   // ... los 12 dominios
   e.GET("/*", spaHandler(distFS))   // todo lo demás → la SPA embebida
   ```

7. **Configura timeouts** del servidor HTTP (anti slowloris), lanza el **job de purga de sesiones** en una goroutine, arranca el servidor en otra, y **espera el apagado ordenado** con el `select` que vimos.

El `spaHandler` es el pegamento cliente-servidor: si la ruta pedida existe como fichero en `dist/` lo sirve; si no (p. ej. `/flights`, una ruta de React Router), devuelve `index.html` para que la SPA tome el control. Esto es lo que hace que recargar en una ruta profunda no dé 404.

**Conceptos nuevos:** *composición raíz* (todo se cablea en un sitio, sin inyección mágica), *middleware* (funciones que envuelven a los handlers; ver 4.5), *grupos de rutas* de Echo.

| Archivo | Rol |
|---|---|
| `cmd/server/main.go` | Arranque del servidor: config, pool, registro de rutas, middlewares, apagado ordenado, job de purga, `spaHandler`, `healthHandler`, `requestLogger`. |
| `cmd/bootstrap/main.go` | CLI suelta para fijar la contraseña de un `person_user` existente (alta de admin). Lee `-user`, contraseña por flag/stdin/`AETHER_BOOTSTRAP_PASSWORD`, llama a `auth.Service.SetPassword`. |

### 4.2 `internal/config` — configuración centralizada

**Propósito.** Único lugar del código donde se leen variables de entorno `AETHER_*`. La regla del proyecto: **nada de `os.Getenv` desperdigado**. Centralizar permite **validar al arranque** y fallar pronto.

**Deep-dive.** `config.Load()` devuelve `(Config, error)`. Lee `AETHER_ADDR` (default `:8080`), `AETHER_DATABASE_URL` (**obligatoria** — si falta, error y el proceso no arranca), `AETHER_SESSION_TTL` (acepta duración Go `"8h"` o segundos `"28800"`), `AETHER_COOKIE_SECURE` y `AETHER_TRUSTED_PROXY`. Es un patrón muy "Go": en lugar de defaults silenciosos peligrosos, configuración explícita y validada.

| Archivo | Rol |
|---|---|
| `config.go` | Struct `Config`, `Load()` (lee y valida el entorno), `parseTTL`. |
| `config_test.go` | Tests de parseo/validación de la configuración. |

### 4.3 `internal/db` — el pool de conexiones

**Propósito.** Crear y configurar el *connection pool* de PostgreSQL con **pgx** (el driver/toolkit de Postgres para Go; no usamos `database/sql` estándar).

**Deep-dive.** `DefaultConfig(dsn)` fija tamaños del pool (25 máx, 5 mín, vida máxima 1 h). `New(ctx, cfg)` parsea el DSN, crea el pool y hace un **`Ping`** con timeout para fallar pronto si la BD no responde. Un `*pgxpool.Pool` es *thread-safe* y se comparte entre todas las goroutines/handlers — por eso se crea **una vez** en `main` y se inyecta a todos los servicios.

| Archivo | Rol |
|---|---|
| `pool.go` | `Config`, `DefaultConfig`, `New` (crea el pool pgx y lo verifica con `Ping`). |

### 4.4 `queries/` + `internal/queries/` — SQL a mano, Go generado (sqlc)

Esta es la pareja **más importante de entender** del backend.

**`queries/<dominio>.sql` (lo escribes tú).** SQL plano, con una anotación por consulta que le dice a sqlc qué generar:

```sql
-- queries/festivos.sql
-- name: ListFestivos :many
SELECT festivo_sk, festivo_dia, festivo_motivo FROM detall.festivos ORDER BY festivo_dia;

-- name: InsertFestivo :one
INSERT INTO detall.festivos (festivo_dia, festivo_motivo) VALUES ($1, $2) RETURNING festivo_sk;

-- name: UpdateFestivo :execrows
UPDATE detall.festivos SET festivo_dia = $1, festivo_motivo = $2 WHERE festivo_sk = $3;
```

El `:many` / `:one` / `:execrows` indica la forma del resultado (lista / fila única / nº de filas afectadas). `$1, $2...` son **parámetros posicionales** (consultas siempre parametrizadas → no hay inyección SQL).

**`internal/queries/` (lo genera `make sqlc`, NO se edita).** Por cada consulta, sqlc emite una **función Go tipada** y los structs de parámetros/resultado:

```go
// internal/queries/festivos.sql.go  (generado)
func (q *Queries) InsertFestivo(ctx context.Context, arg InsertFestivoParams) (int32, error) { ... }
type InsertFestivoParams struct {
    FestivoDia    pgtype.Date `json:"festivo_dia"`
    FestivoMotivo string      `json:"festivo_motivo"`
}
```

Ganas el **tipado y la autocompletación de Java/JPA** sin escribir un ORM ni mappers: el SQL es tuyo (control total), pero las firmas Go son seguras y las genera la máquina. El `DBTX` que vimos en 1.3 es lo que permite ejecutar esas funciones tanto sobre el pool como sobre una transacción.

**Conceptos nuevos:** *código generado* (nunca se edita a mano; se regenera con `make sqlc` tras tocar el `.sql`), tipos `pgtype.*` (envoltorios de pgx para tipos SQL que pueden ser NULL, p. ej. `pgtype.Date` con su campo `.Valid`).

| Archivo (representativos) | Rol |
|---|---|
| `queries/*.sql` (auth, flights, festivos, comisiones, ratings, dashboard, lookups, persons, availability, hours, esfuerzo, events, training, papeletas) | **Fuente**: el SQL que escribes, una familia por dominio. |
| `internal/queries/*.sql.go` | **Generado**: funciones tipadas por consulta. No editar. |
| `internal/queries/models.go` | **Generado**: structs espejo de cada tabla (`DetallFestivo`, ...). |
| `internal/queries/db.go` | **Generado**: interfaz `DBTX`, `New(db)`, `WithTx(tx)`. |
| `internal/queries/querier.go` | **Generado**: interfaz `Querier` con todas las funciones (útil para mockear). |

### 4.5 `internal/auth` — autenticación, sesiones y permisos

**Propósito.** Login/logout, gestión de **sesiones** y los **middlewares** de autorización. Es transversal: lo usan todos los dominios.

**Conceptos nuevos: middleware.** En Echo, un middleware es una función que **envuelve** a un handler: recibe el siguiente handler y devuelve uno nuevo que hace algo antes/después. Es como un filtro de servlets, pero componible por ruta. `RequireAuth` y `RequirePermission` son middlewares.

**Deep-dive 1: contraseñas (`password.go`).** Se usa **argon2id** (RFC 9106), el estándar moderno para hashear contraseñas (resistente a GPU). `HashPassword` genera un salt aleatorio y produce un *PHC string* autodescriptivo (`$argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>`). `VerifyPassword` lo parsea y compara con **`subtle.ConstantTimeCompare`** (comparación de tiempo constante, para no filtrar información por *timing*). Nunca se guarda la contraseña, solo su hash.

**Deep-dive 2: sesiones (`service.go`).** En el login (`Login`), tras verificar la contraseña:

```go
token, tokenHash, err := newSessionToken()   // 32 bytes aleatorios → (token claro, sha256(token))
// ...
s.q.CreateSession(ctx, queries.CreateSessionParams{
    TokenHash: tokenHash,             // en BD se guarda SOLO el hash
    PersonFk:  row.PersonSk,
    IpAddress: ipAddress,
    ExpiresAt: pgtype.Timestamptz{Time: expires, Valid: true},
})
return token, &u, nil                 // el token CLARO se devuelve y va a la cookie
```

El **token claro** viaja al cliente en la cookie; en la BD solo está su **SHA-256**. Si te roban la BD, no pueden reconstruir tokens válidos. `Validate` busca la sesión por el hash del token, comprueba caducidad y actualiza `last_seen_at` en un solo round-trip (`TouchSessionAndGetUser`). El job de `main` purga las caducadas.

**Deep-dive 3: los middlewares (`middleware.go`).**

```go
func RequireAuth(svc *Service) echo.MiddlewareFunc { /* lee cookie → Validate → mete *User en el contexto, o 401 */ }

func RequirePermission(levels ...string) echo.MiddlewareFunc {
    allowed := make(map[string]struct{}, len(levels))
    for _, l := range levels { allowed[l] = struct{}{} }
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            user := CurrentUser(c)
            if _, ok := allowed[user.PermissionLevel]; !ok {
                return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
            }
            return next(c)
        }
    }
}
```

`RequirePermission` es una **allow-list exacta** (sin jerarquía): construye un set con los niveles permitidos y deja pasar solo si el del usuario está dentro. Por eso cada ruta declara exactamente qué admite. `CurrentUser(c)` recupera el `*User` que `RequireAuth` dejó en el contexto.

**Deep-dive 4: cookies y handlers (`handlers.go`).** El login lleva un **rate-limiter por IP** (ráfaga de 5, luego 1 cada 2 s) contra fuerza bruta. La cookie de sesión es `HttpOnly` (no accesible desde JS → mitiga XSS), `SameSite=Lax` (mitiga CSRF) y `Secure` si `AETHER_COOKIE_SECURE=true`. Ante credenciales inválidas se responde un mensaje **genérico** ("invalid credentials"), sin distinguir "usuario no existe" de "contraseña mala", para no dar pistas.

> **Por qué cookie y no token Bearer.** Es una app de intranet con frontend servido por el mismo origen. La cookie `HttpOnly` la gestiona el navegador sola (no hay que guardar tokens en `localStorage`, vulnerable a XSS) y simplifica el cliente.

| Archivo | Rol |
|---|---|
| `service.go` | `Service`: login (verifica password + crea sesión), logout, validate, set-password, purga; helpers de token (aleatorio + SHA-256). |
| `password.go` | Hash/verificación argon2id (PHC string, comparación de tiempo constante). |
| `middleware.go` | `RequireAuth`, `RequirePermission` (allow-list), `CurrentUser`; constantes de niveles y nombre de cookie. |
| `handlers.go` | Rutas `/auth/login` (con rate-limit), `/auth/logout`, `/auth/me`; `userDTO`; gestión de la cookie de sesión. |
| `password_test.go`, `middleware_test.go`, `integration_test.go` | Tests unitarios (hash, middleware) y de integración (login real contra BD efímera). |

### 4.6 `internal/httpx` — utilidades HTTP transversales

**Propósito.** Lo que no pertenece a ningún dominio: el **manejador central de errores** y la recepción de logs del frontend.

**Deep-dive: `errors.go`.** Implementa el contrato de errores de la Parte 1.5 en el punto donde Echo entrega cualquier error:

```go
// internal/httpx/errors.go
var he *echo.HTTPError
if errors.As(err, &he) {            // ¿es un error HTTP "esperable" (4xx con mensaje seguro)?
    code = he.Code
    // ... respeta su mensaje
}
if code >= http.StatusInternalServerError {
    msg = "internal server error"   // NUNCA exponer detalle interno en 5xx
    logger.Error("request failed", slog.String("request_id", ...), slog.Any("err", err))
}
```

`errors.As` es como `errors.Is` pero además **extrae** el error al tipo buscado (≈ `catch (HTTPError e)` capturando la instancia). Si es un `*echo.HTTPError` (lo que produces con `echo.NewHTTPError(4xx, msg)`), se respeta su código y mensaje. Cualquier otra cosa es un 500: se **loguea con el `request_id`** (correlable con la línea de log de acceso) y al cliente solo le llega `"internal server error"`. Así nunca se filtran nombres de tablas, SQL o constraints.

| Archivo | Rol |
|---|---|
| `errors.go` | `NewHTTPErrorHandler`: 4xx esperables se respetan; 5xx → log con request-id + mensaje genérico. |
| `frontendlog.go` | Endpoint que recibe logs del navegador (`POST /logs`) y los vuelca al logger del servidor. |
| `errors_test.go` | Tests del manejador de errores. |

### 4.7 `internal/domain/` — los 12 dominios

Aquí vive la lógica de negocio. Todos siguen el molde de la Parte 1.11. Veamos dos extremos.

**Deep-dive A — dominio pequeño: `festivos` (un solo fichero).** CRUD de un catálogo global (días festivos, sin escuadrilla). En `festivos.go` conviven DTOs, sentinel errors, `Service`, `Handlers` y helpers. El `Register` muestra el patrón de permisos:

```go
// internal/domain/festivos/festivos.go
func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
    mw := auth.RequireAuth(authSvc)
    administrativo := auth.RequirePermission(auth.PermAdministrativo)
    g.GET("/festivos", h.List, mw)                       // leer: cualquier autenticado
    g.POST("/festivos", h.Create, mw, administrativo)    // escribir: solo Administrativo
    g.PUT("/festivos/:id", h.Update, mw, administrativo)
    g.DELETE("/festivos/:id", h.Delete, mw, administrativo)
}
```

El `Create` del handler es el mapeo sentinel→HTTP canónico (validación→400, duplicado→409, otro→`return err`→500). El service valida (`strings.TrimSpace`, `parseDate`), comprueba duplicado y delega en las queries. Léelo entero: es la **plantilla mental** de todos los dominios.

**Deep-dive B — dominio grande y transaccional: `flights`.** Es el más complejo. Separa `dto.go` (contrato JSON de entrada/salida, espejo del formulario de vuelo), `service.go` (758 líneas) y `handlers.go`. Dos cosas notables:

1. **Insert transaccional** (un vuelo toca ~12 tablas hijas: horas por persona, aproximaciones, aterrizajes, papeletas, cupos, pasajeros...). Todo o nada:

   ```go
   // internal/domain/flights/service.go (Insert)
   tx, err := s.pool.Begin(ctx)
   defer tx.Rollback(ctx)                  // rollback si algo falla antes del Commit
   if err := setAuditGUCs(ctx, tx, userID, ip); err != nil { return ..., err }
   q := queries.New(tx)                    // MISMAS queries, ahora sobre la transacción
   flightSk, err := q.InsertFlight(ctx, ...)
   for _, pilot := range data.Pilots { insertPilot(ctx, q, flightSk, pilot) }
   // ... resto de tablas hijas
   // (al final, tx.Commit(ctx))
   ```

2. **Auditoría vía GUCs.** Antes de insertar, setea variables de sesión de PostgreSQL que un trigger lee para registrar **quién** hizo el cambio:

   ```go
   func setAuditGUCs(ctx context.Context, tx pgx.Tx, userID, ip string) error {
       tx.Exec(ctx, "SELECT set_config('aether.user_id', $1, true)", userID)
       tx.Exec(ctx, "SELECT set_config('aether.ip_address', $1, true)", ip)
       return nil
   }
   ```

   El `true` final hace los GUCs **locales a la transacción** (se descartan al terminar). El trigger `tr_audit_flight` (migración de triggers) los lee y escribe la fila de auditoría.

El **listado** (`List`) hace lo contrario al insert: para una página de vuelos, *bulk-fetchea* cada tabla hija en una sola query y **agrupa en Go** por `(vuelo, persona)` para componer el JSON anidado. Es el patrón "evita N+1": pocas queries grandes en vez de muchas pequeñas.

**Aislamiento por escuadrilla en acción.** El handler saca `u.EscuadrillaID` del usuario autenticado y el service lo pasa como filtro a `ListFlights`/`CountFlights`/`InsertFlight`. Un usuario nunca ve ni crea vuelos de otra escuadrilla.

**Tabla de los 12 dominios** (con el nivel de permiso que exige *escribir*; **leer** siempre es cualquier autenticado):

| Dominio | Responsabilidad | Permiso de escritura | Forma |
|---|---|---|---|
| `flights` | Registro de vuelos y sus horas (insert transaccional, listado anidado). | Operacional | dividido |
| `lookups` | Catálogos de vuelo (aeronaves, lugares) — lectura unificada `GET /lookups/:name`. | Operacional | dividido |
| `events` | Tipos de evento de vuelo. | Operacional | único |
| `papeletas` | Papeletas de instrucción. | Operacional | único |
| `persons` | Personal de la escuadrilla. | Administrativo | único |
| `comisiones` | Comisiones de servicio y sus días/personas. | Administrativo | dividido |
| `festivos` | Catálogo global de festivos. | Administrativo | único |
| `availability` | Ausencias y disponibilidad. | Operacional o Administrativo | único |
| `ratings` | Calificaciones de tripulantes (varias categorías). | Operacional o Administrativo | dividido |
| `training` | Adiestramiento/instrucción (pilotos y dotaciones). | (lecturas/composición) | único |
| `hours` | Horas de vuelo agregadas de pilotos. | (lectura) | único |
| `esfuerzo` | Métrica de esfuerzo por periodo. | (lectura) | único |
| `dashboard` | Estadísticas y gráficas de la home. | (lectura) | dividido |

> Para el reparto exacto de permisos por ruta, la fuente canónica es el `CLAUDE.md` raíz y el propio `Register(...)` de cada dominio.

### 4.8 `internal/testdb` — base de datos efímera para tests

**Propósito.** Levantar una BD PostgreSQL **desechable** para los tests de **integración** (los que tocan SQL de verdad, no mocks). Si defines `AETHER_TEST_DATABASE_URL`, `make test` corre también estos tests.

**Conceptos nuevos: tests en Go.** No hay JUnit; el testing es parte del lenguaje. Un fichero `*_test.go` con funciones `func TestXxx(t *testing.T)`; se ejecuta con `go test`. El idioma común es *table-driven*: un slice de casos `{entrada, esperado}` y un bucle que los recorre. Lo ves en `dashboard/range_test.go`, `config_test.go`, `auth/*_test.go`.

| Archivo | Rol |
|---|---|
| `testdb.go` | Helpers para crear/migrar/limpiar una BD efímera por test de integración. |

### 4.9 `migrations/` — evolución del esquema de PostgreSQL

**Propósito.** El esquema de la BD se versiona como **migraciones numeradas** (`0001_...up.sql` / `.down.sql`), aplicadas con golang-migrate. Es el "control de versiones" de la base de datos.

**Conceptos nuevos.** Dos tipos de migración:

- **De esquema** (0001 init+auth, 0003 triggers): llevan **par `up`/`down`** (aplicar/revertir).
- **De seed** (datos): `0002_seed_lookups`, `0004_seed_productive_data` son **solo-up** (no se revierten; en dev se hace drop+create, en prod solo se aplican).

**Regla crítica (RGPD).** Algunos archivos contienen datos personales y **no se versionan en este repo público**: `0002_seed_lookups.up.sql`, `0004_seed_productive_data.up.sql`, la BD SQLite y el mapeo de usuarios. Son **symlinks** al repo privado `aether-data`, que debe estar clonado **junto a** `aether-web`. El CI tiene un *leak-guard* que falla si alguno aparece versionado. Revisa `git status` antes de cada push y **nunca** `git add -f`.

**Timestamps.** Usar siempre `timestamptz` (con zona), nunca `TIMESTAMP` pelado: las sesiones lo usan por un bug real de zonas horarias (el esquema de auth/sesión vive consolidado en `0001`).

| Archivo (representativos) | Rol |
|---|---|
| `0001_init_schema.up/down.sql` | Esquema base + auth (tablas `detall.*`, CHECK de permisos, `person_password_hash`, tabla `session` en `timestamptz`). |
| `0003_triggers.up/down.sql` | Triggers de auditoría (`tr_audit_flight` y los GUCs `aether.*`). |
| `0002_seed_lookups.up.sql`, `0004_seed_productive_data.up.sql` | **Symlinks privados** (RGPD), solo-up. |
| `examples/*.sql.example`, `README.md` | Plantillas públicas y convenciones de migración. |

---

## Parte 2. TypeScript y React para quien viene de Java

> La pusimos después del backend a propósito, para no cortar el hilo Go→arquitectura. Si vienes directo a aprender el frontend, esta es tu puerta de entrada.

### 2.1 TypeScript en 10 minutos (desde Java)

TypeScript (TS) es JavaScript **con tipos** que se comprueban en compilación y luego **desaparecen** (se "borran": el navegador ejecuta JS puro). Conceptos que necesitas:

- **Tipado estructural, no nominal.** En Java dos clases con los mismos campos son tipos distintos. En TS, si dos objetos tienen **la misma forma**, son compatibles, aunque no compartan nombre ni "herencia". Lo que importa es la *forma*, no el linaje. Por eso un objeto literal `{ status: "ok" }` encaja en `interface HealthResponse { status: string }` sin declararlo.
- **`interface` vs `type`.** Ambos describen formas. Por convención: `interface` para objetos (`interface Person { ... }`, como un DTO), `type` para uniones, alias y tipos compuestos (`type HttpMethod = "GET" | "POST" | ...`). Aquí verás los dos; son casi intercambiables para objetos.
- **Uniones y literales.** `type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'`: el valor solo puede ser **uno de esos strings**. Es como un enum ligero, comprobado en compilación. Muy usado.
- **`enum`.** TS también tiene enums "de verdad": `enum PermissionLevel { COMUN = "Común", ... }` (en `UserProvider.tsx`). Funciona como en Java.
- **Genéricos.** Idénticos en idea a Java: `http<T>(...)` devuelve una `Promise<T>`; `useApiQuery<DashboardStaticStats>(...)`. El `<T>` parametriza el tipo de retorno.
- **`null` vs `undefined`.** TS tiene **dos** "vacíos": `null` (ausencia explícita) y `undefined` (no asignado). `person_dni: string | null` significa "string o explícitamente nulo". El operador `?.` (optional chaining) y `??` (nullish coalescing: "usa la derecha si la izquierda es null/undefined") aparecen por todas partes: `data.person_nk?.trim()`, `escId ?? 0`.
- **`unknown` vs `any`.** `any` apaga el chequeo de tipos (evitar). `unknown` es "no sé el tipo todavía, fuérzame a comprobarlo antes de usarlo" (seguro). El cliente HTTP usa `unknown` para el body y luego acota.
- **`Promise` y `async/await`.** Una `Promise<T>` es un valor futuro (≈ `CompletableFuture<T>`). `async function f(): Promise<T>` y `await f()` son azúcar para encadenar asincronía como si fuera secuencial. Todo lo que va a la red es asíncrono.

> **Equivalente Java.** TS ≈ Java en sintaxis de tipos, pero **estructural** y con los tipos borrados en runtime. Las uniones de literales no tienen equivalente directo (las imitarías con enums). `Promise`/`async-await` ≈ `CompletableFuture` con `async/await` como azúcar.

### 2.2 React: el modelo mental

React construye la interfaz a partir de **componentes**, que son **funciones** que devuelven **JSX** (HTML escrito dentro de JS/TS). No hay plantillas separadas: el marcado vive en el código.

```tsx
function FullPageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
```

Ideas clave para alguien de Java/Swing/JSP:

- **El render es declarativo.** Tú describes *cómo se ve la UI para un estado dado*; no manipulas el DOM a mano. Cuando el estado cambia, React **vuelve a llamar a la función** del componente y reconcilia el DOM por ti. No hay `setText()`/`getElementById` (salvo casos puntuales como exportar un CSV).
- **Props.** Los componentes reciben datos por **props** (argumentos), inmutables desde dentro. `<Button variant="outline" size="sm">`: `variant` y `size` son props. Son como los parámetros del constructor de un componente.
- **Estado (`useState`).** Para datos que cambian con el tiempo dentro de un componente: `const [drawerOpen, setDrawerOpen] = useState(false)`. `drawerOpen` es el valor actual; `setDrawerOpen(true)` lo cambia **y provoca un re-render**. **Nunca** mutas el estado directamente; llamas al setter. Esto es lo que dispara el repintado.
- **JSX es expresiones.** `{condición && <X/>}` pinta `<X/>` solo si la condición es cierta; `{lista.map(x => <Fila key={x.id} .../>)}` pinta una fila por elemento (el `key` ayuda a React a identificarlas). Lo ves en las rutas de `App.tsx` y en cada tabla.

### 2.3 Hooks: estado y efectos reutilizables

Un **hook** es una función que empieza por `use` y engancha un componente al "sistema" de React. Los que verás:

- **`useState`** — estado local (arriba).
- **`useEffect`** — ejecutar **efectos secundarios** (fetch, suscripciones, timers) **después** del render, y limpiarlos. En `DatabaseProvider`:

  ```tsx
  useEffect(() => {
      poll();                                   // efecto: arranca el polling
      const interval = setInterval(poll, ...);
      return () => clearInterval(interval);     // CLEANUP: al desmontar, limpia el timer
  }, [poll]);                                    // deps: re-ejecuta si `poll` cambia
  ```

  El **array de dependencias** (`[poll]`) controla cuándo se re-ejecuta; la función que devuelves es la **limpieza** (≈ `finally`/`dispose`). `[]` = "solo al montar".
- **`useCallback` / `useMemo`** — memorizan una función o un valor entre renders para no recrearlos en cada pintada (importante porque, si una función cambia de identidad, los `useEffect`/hijos que dependen de ella se re-disparan). En `UserProvider`, `login`/`logout`/`refreshUser` van envueltos en `useCallback`.
- **Reglas de los hooks** (las dos que importan): solo se llaman **en el nivel superior** de un componente o de otro hook (nunca dentro de `if`/bucles), y solo desde componentes o **hooks personalizados**. El orden de llamada debe ser estable entre renders.

**Hooks personalizados = la convención de oro de este repo.** Un hook propio es una función `useAlgo()` que **encapsula la lógica** (estado + datos + handlers) para que el componente quede **solo con el render**. `usePersonnel()` es exactamente eso (ver Parte 5). Es el equivalente a sacar la lógica a un "controller/viewmodel" y dejar la "vista" tonta.

> **Equivalente Java.** No hay analogía directa; piensa en hooks como el "ciclo de vida + estado observable" de un componente, expresado como funciones componibles. `useEffect` ≈ callbacks de ciclo de vida (`init`/`dispose`). Un hook personalizado ≈ extraer la lógica a un ViewModel inyectable.

### 2.4 El ecosistema y por qué cada pieza

El frontend no es "React a pelo": es un conjunto de librerías, cada una con un trabajo. Conocerlas evita reinventar:

| Pieza | Qué resuelve | Dónde se ve |
|---|---|---|
| **Vite** | Build tool y *dev server* rapidísimo (con *hot reload*). Compila TS+JSX y empaqueta. | `npm run dev`, `vite.config`. |
| **React Router** | Navegación SPA: mapea URLs a componentes sin recargar la página. | `App.tsx` (`<Routes>/<Route>`). |
| **TanStack Query** | **Estado de servidor**: caché, deduplicación, estados de carga/error, invalidación. *La pieza central de datos.* | `lib/apiQuery.ts`, todos los hooks de feature. |
| **react-hook-form** | Formularios performantes (sin re-render por tecla) con validación. | Formularios `AddEdit*Form.tsx`. |
| **zod** | Validación de esquemas en runtime + **infiere el tipo TS** del formulario. | `components/forms/schema.ts`. |
| **Radix UI** | Primitivas de UI accesibles *sin estilo* (diálogos, selects, tooltips...). | `components/ui/*`. |
| **shadcn/ui + CVA** | Capa fina sobre Radix con estilos Tailwind y **variantes**. | `components/ui/button.tsx`. |
| **Tailwind CSS v4** | Estilos por **clases utilitarias** en el marcado + tokens de color OKLCH. | `className="flex items-center..."`, `app/theme.css`. |
| **sonner** | *Toasts* (notificaciones). | `toast.success(...)`. |
| **lucide-react** | Iconos. | `<Loader2 />`. |
| **recharts** | Gráficas del dashboard. | `features/dashboard/components/charts/`. |

**TanStack Query, el concepto clave.** Distingue dos tipos de estado: el **local** (un checkbox abierto/cerrado → `useState`) y el **de servidor** (los datos que viven en la BD). Para el segundo, gestionar a mano `loading`/`error`/`refetch`/caché es tedioso y propenso a bugs. TanStack Query lo hace por ti: identifica cada dato con una **query key**, lo cachea, sabe si está "fresco" o "viejo" (`staleTime`), y cuando **mutas** (escribes), **invalidas** las keys afectadas para que se vuelvan a pedir. Por eso el `CLAUDE.md` marca como **deprecado** el viejo patrón `http()` + `useState` + refetch manual para lecturas.

**CVA + `cn()` (cómo se estilan los componentes).** En `button.tsx`:

```tsx
const buttonVariants = cva("inline-flex items-center ...base...", {
    variants: { variant: { default: "bg-primary ...", outline: "border ...", ... },
                size:    { default: "h-9 px-4 ...", sm: "h-8 ...", icon: "size-9" } },
    defaultVariants: { variant: "default", size: "default" },
});
// uso: className={cn(buttonVariants({ variant, size, className }))}
```

`cva` ("class variance authority") genera la cadena de clases Tailwind correcta según las props `variant`/`size`. `cn()` (en `lib/utils.ts`) combina clases y resuelve conflictos de Tailwind (`twMerge`): si pasas `p-2` y `p-4`, gana el último. Es el patrón estándar de shadcn.

**Tailwind + tokens.** Los colores **no se hardcodean**: hay tokens semánticos (`bg-primary`, `text-muted-foreground`, `bg-table-header`) definidos una sola vez en `app/theme.css` (en OKLCH, con variantes claro/oscuro). El modo oscuro lo activa una clase `.dark` en `<html>`. Regla del repo: usa tokens, nunca `text-gray-400` ni hex. Detalle en `web/CLAUDE.md`.

---

## Parte 5. Recorrido del frontend, directorio por directorio

Mismo molde: **propósito → conceptos → deep-dive → tabla**. Todo cuelga de `web/src/`.

### 5.1 `app/` — arranque y composición de la SPA

**Propósito.** El punto de entrada del frontend y el armazón de providers + rutas.

**Deep-dive.** `main.tsx` monta React en el `<div id="root">` del HTML:

```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

`App.tsx` arma el **árbol de providers** (de fuera hacia dentro: `ThemeProvider` → `QueryClientProvider` → `UserProvider` → `DatabaseProvider` → `TooltipProvider`) y dentro las **rutas**. Patrón importante: las rutas privadas cuelgan de un `<ProtectedRoute>` que bloquea si no hay sesión:

```tsx
function ProtectedRoute() {
    const { isAuthenticated, loading } = useUser();
    if (loading) return <FullPageLoader />;
    if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
    return <Outlet />;   // pinta la ruta hija
}
```

`<Outlet/>` es el "agujero" donde React Router inserta la ruta hija (como un `<jsp:include>` dinámico). `theme.css` es la **fuente única de los colores** (tokens OKLCH, claro/oscuro).

| Archivo | Rol |
|---|---|
| `app/main.tsx` | Monta `<App/>` en el DOM (`createRoot`), carga la fuente Inter, `StrictMode`. |
| `app/App.tsx` | Árbol de providers, rutas (`ProtectedRoute`, `LoginGate`, `MainLayout`), toaster global. |
| `app/theme.css` | Tokens de color OKLCH (`:root` claro / `.dark` oscuro) + mapeo a clases Tailwind. |
| `app/App.css` | Estilos globales puntuales. |

### 5.2 `providers/` — estado global vía React Context

**Propósito.** Estado compartido por toda la app. **Conceptos: Context.** `createContext` + un `<Provider value={...}>` exponen datos a todo el subárbol sin pasar props mano a mano (*prop drilling*). Un hook `useX()` los consume con `useContext`.

**Deep-dive: `UserProvider.tsx`.** Mantiene la sesión. Expone `useUser()` (estado + acciones) y hooks derivados:

- `login(user, pass)` → `POST /auth/login`, guarda el usuario en estado.
- `logout()` → `POST /auth/logout`, limpia.
- `refreshUser()` → `GET /auth/me`, **restaura la sesión al montar** (si hay cookie válida). Un 401 se trata como "no hay sesión" (no es un error que mostrar).
- `hasPermission(level)` / `canAccess(levels)`: comprobación **cosmética** de permisos para ocultar botones (la garantía real es el 403 del backend).
- `useEscuadrilla()`: el `escuadrillaId` que entra en **todas las query keys** (aislamiento de caché).

`DatabaseProvider.tsx` hace *polling* ligero de `GET /health` para alimentar el indicador de conexión del sidebar; no abre conexiones (eso es del binario Go). Usa `useRef` (`inFlightRef`) para evitar peticiones solapadas — un `ref` es un valor mutable que **no** provoca re-render.

| Archivo | Rol |
|---|---|
| `UserProvider.tsx` | Sesión: `useUser`, `useEscuadrilla`, `useHasPermission`, `login/logout/refreshUser`, `PermissionLevel`. |
| `DatabaseProvider.tsx` | Estado de conexión por polling de `/health`; `useDatabase`. |
| `index.ts` | *Barrel* que re-exporta los providers (`ThemeProvider` vive en `components/theme/`). |

### 5.3 `lib/` — el núcleo técnico (HTTP + datos)

**Propósito.** Las utilidades transversales sin UI: cliente HTTP, hooks de datos, claves de caché, logger.

**Deep-dive 1: `http.ts`.** Un envoltorio fino sobre `fetch` que: prepende `/api/v1`, manda la **cookie** (`credentials: "include"`), serializa el body a JSON, gestiona `204 No Content`, y ante respuesta no-OK lanza un `HttpError` con `status` y `message`. Es la **única** puerta de salida a la red.

**Deep-dive 2: `apiQuery.ts`** (ya lo viste en backend conceptualmente; aquí es donde vive). Cuatro hooks sobre TanStack Query:

- `useApiQuery<T>(method, path, options, queryKey)` — lecturas. Se **deshabilita** hasta que el usuario esté cargado (los datos no se piden sin sesión).
- `useApiPaginatedQuery<TData, TRaw>({ path, queryKey, transform })` — respuestas `{ items, total_count }`. `TRaw` tipa lo **crudo** del servidor y `transform` lo convierte a `TData` (el tipo de la UI).
- `useApiMutation<TResult, TVars>(method, path, { invalidateKeys, successMessage })` — escrituras. Tras el éxito: lanza el **toast**, e **invalida** las query keys indicadas (refresca las listas). El error ya lo notifica con un toast — **no dupliques** toasts en el componente.
- `useLookupQuery<T>(name, queryKey)` — lookups con `staleTime: Infinity` (datos de referencia que casi no cambian).

**Deep-dive 3: `queryKeys.ts`.** Una *factory* de claves jerárquicas donde **toda clave incluye `escuadrillaId`**:

```ts
personnel: {
    all:  (escId) => ['personnel', escId],
    list: (escId, params) => ['personnel', 'list', escId, params],
},
```

Esto es lo que hace coherente la caché con la RLS del backend: nunca mezclas datos de dos escuadrillas. Para invalidar tras una mutación, usas el **prefijo** `queryKeys.personnel.all(escId)` y TanStack Query refresca todo lo que cuelga de él.

| Archivo | Rol |
|---|---|
| `http.ts` | Cliente fetch (`http`, `httpGet/Post/Put/Delete`), `HttpError`, base `/api/v1`, cookie. |
| `apiQuery.ts` | Hooks TanStack: `useApiQuery`, `useApiPaginatedQuery`, `useApiMutation`, `useLookupQuery`. |
| `queryKeys.ts` | Factory de claves de caché (todas con `escuadrillaId`). |
| `queryClient.ts` | Instancia y config global del `QueryClient`. |
| `logger.ts` | Logger del front que hace `POST /logs` al backend. |
| `utils.ts` | `cn()` (merge de clases Tailwind), helpers de fecha/coma-a-punto. |
| `reactSelectClassNames.ts` | Clases compartidas para react-select. |

### 5.4 `components/ui/` — primitivas (Radix + shadcn)

**Propósito.** Bloques de UI reutilizables y accesibles (botón, diálogo, select, tabla, tooltip...). **No llevan lógica de datos**: solo render y comportamiento de UI. Son la capa shadcn/ui sobre Radix, estilada con Tailwind + CVA (ver `button.tsx` en la Parte 2.4). Cuando necesitas un control, lo coges de aquí; rara vez los editarás salvo para añadir una variante.

| Archivo (muestra) | Rol |
|---|---|
| `button.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `field.tsx` | Controles de formulario. |
| `dialog.tsx`, `alert-dialog.tsx`, `drawer.tsx`, `sheet.tsx`, `popover.tsx` | Superficies modales/flotantes. |
| `select.tsx`, `command.tsx`, `dropdown-menu.tsx`, `menubar.tsx`, `navigation-menu.tsx` | Selección y menús. |
| `table.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `separator.tsx`, `skeleton.tsx` | Presentación. |
| `chart.tsx`, `progress.tsx`, `calendar.tsx`, `tooltip.tsx`, `hover-card.tsx`, `sonner.tsx` | Gráficas, fechas, feedback. |
| `sidebar.tsx`, `scroll-area.tsx`, `collapsible.tsx`, `switch.tsx`, `alert.tsx` | Layout y misceláneos. |

### 5.5 `shared/` — lo común entre features

**Propósito.** Hooks y componentes que usan **varias** features (a diferencia de `lib/`, que es infraestructura, aquí hay piezas con algo de UI/dominio compartido).

**Deep-dive: el patrón de tablas "container-scroll".** La app es solo de escritorio pero debe comportarse a cualquier ancho. Todas las tablas anchas usan el mismo arquetipo: una zona de tabla que **scrollea dentro de un contenedor de altura acotada**, con la cabecera (y la 1ª columna en matrices) **congeladas**. Las piezas:

- `PageTableContainer` — el contenedor "glass" con bordes redondeados.
- `StickyTableHeader` — cabecera pegajosa (siempre este componente, nunca `<thead className="sticky">` a mano).
- `stickyColumn.ts` — helpers para congelar la 1ª columna: `stickyFirstColClass(idx, extra)` y `STICKY_CORNER`. Codifican las **capas z-index** (cuerpo normal · 1ª col `z-10` · cabecera `z-20` · esquina `z-30`) y los **fondos opacos** (`bg-table-sticky-*`) para tapar lo que scrollea por detrás.

`useLookups.ts` agrupa los hooks de datos de referencia (`useAircrafts`, `useAuthorities`...), cada uno un `useLookupQuery` con su clave. `useConfirmationDialog.ts` gestiona el patrón "escribe X para confirmar" de bajas peligrosas.

| Archivo (muestra) | Rol |
|---|---|
| `hooks/useLookups.ts` | Hooks de lookups (referencia) con caché infinita. |
| `hooks/useConfirmationDialog.ts` | Estado del diálogo de confirmación por texto. |
| `components/common/PageTableContainer.tsx`, `StickyTableHeader.tsx`, `TableRow.tsx`, `DetailsRow.tsx`, `stickyColumn.ts` | Arquetipo de tabla con scroll y columnas/cabecera congeladas. |
| `components/common/PageCard.tsx`, `PageControls.tsx`, `SearchInput.tsx`, `GradientTitle.tsx`, `DatePicker.tsx`, `DateTimePicker.tsx`, `SegmentedDateRangeAether.tsx` | Cabeceras de página, filtros, selectores de fecha. |
| `components/common/badges/*` | Insignias de rol/escala/evento/plan/característica. |
| `components/common/Glass*`, `glassColors.ts` | Barras de progreso decorativas (excepción documentada al theming). |
| `components/layout/*` | `MainLayout`, `AppSidebar`, `Topbar`, `TopbarMenus`, `ConnectionIndicatorSidebar`. |

### 5.6 `features/` — el corazón funcional

**Propósito.** Una carpeta **por área de la app** (flights, personnel, comisiones, dashboard, ratings, training, availability, hours, effort, papeletas, auth). Dentro, una estructura repetida:

```
features/<feature>/
  pages/        ← componentes de página: SOLO render
  hooks/        ← use<Feature>.ts: la lógica (estado, datos, handlers)
  components/   ← subcomponentes y diálogos/formularios de la feature
  utils/        ← transforms y helpers locales
  index.ts      ← barrel: re-exporta lo público de la feature
```

**La convención canónica: componente = solo render; la lógica vive en un hook.**

**Deep-dive: `personnel`.** La página `Personnel.tsx` apenas tiene lógica: llama a `usePersonnel()` y pinta. Todo lo demás está en el hook `hooks/usePersonnel.ts` (≈290 líneas): el estado (búsqueda, filtros, drawer, selección), la **query de datos** (`useApiPaginatedQuery<Person>` con `transform: transformPersonnelFromDB`), los handlers de alta/edición/baja, el filtrado, la exportación a CSV... y devuelve un objeto con todo lo que la página necesita. Esto es el patrón "vista tonta + viewmodel" llevado a React.

El **formulario** (`components/forms/AddEditPersonForm.tsx`) usa **react-hook-form + zod**. El esquema (`schema.ts`) es la fuente de la validación *y* del tipo:

```ts
export function createPersonSchema(roles, empleos, especialidades, divisiones) {
    return z.object({
        person_user: z.string().min(1, "Requerido").max(50),
        person_phone: z.string().regex(/^[0-9]+$/, "Solo números").min(9).max(15),
        // ...validaciones de DNI, fechas, transforms (capitalizar, toUpperCase)...
    });
}
export type PersonFormValues = z.infer<ReturnType<typeof createPersonSchema>>;
```

`z.infer<...>` **deriva el tipo TS** del esquema: defines la validación una vez y el tipo del formulario sale gratis y siempre coherente. El esquema se crea con datos del servidor (los `roles`/`empleos` válidos vienen de lookups), por eso es una **función** que los recibe.

Los **transforms** (`utils/transformPersonnelFromDB.ts`) adaptan la forma cruda del servidor (`p.nombre`, `p.activo` como bit) al tipo de la UI (`Person` con `person_name`, `person_active: boolean`). Es la costura entre el JSON del backend y el modelo del front.

| Feature | Páginas/contenido | Notas |
|---|---|---|
| `flights` | Registro y listado de vuelos. | La más compleja: formulario multi-tarjeta (`forms/cards/*`), diálogo de gestión de datos (aeronaves/lugares/eventos), validación (`hooks/useFlightValidation.ts`), transforms a/desde BD. |
| `personnel` | Personal. | Deep-dive de arriba. |
| `comisiones` | Comisiones y días de comisión. | Formularios con `useComisionForm.ts`. |
| `dashboard` | Home con tarjetas y gráficas (recharts). | `components/charts/*`. |
| `ratings` | Calificaciones (modelo, operacional, táctica general, liderazgo, mantenimiento). | Matriz persona×categoría; `utils/processing.ts`, `colors.ts`. |
| `training` | Adiestramiento e instrucción (pilotos/dotaciones). | Cuatro páginas matriciales. |
| `availability` | Disponibilidad y ausencias; diálogos de festivos y registro de ausencia. | `absences.ts` (modelo de feature), `hooks/useDisponibilidad.ts`. |
| `hours` | Horas de vuelo de pilotos. | Toggle de modo de vista. |
| `effort` | Esfuerzo por periodo. | — |
| `papeletas` | Papeletas de instrucción. | Form + transform. |
| `auth` | `Login.tsx`. | Usa `useUser().login`. |

### 5.7 `types/` — el contrato con el backend

**Propósito.** Los tipos TS de la API. **Regla:** `types/generated/` lo genera **tygo** desde los structs Go — **no se edita a mano**. Los `types/*.ts` sueltos (`person.ts`, `dashboard.ts`, `flights.ts`...) son **adaptadores finos**: re-exportan los generados con los nombres "históricos" que usa la UI y añaden tipos puramente de presentación. Así, si cambias un DTO en Go y regeneras, el tipo del front se actualiza solo (y el CI lo vigila).

| Archivo | Rol |
|---|---|
| `types/generated/*.ts` | **Generado por tygo** (comisiones, dashboard, flights, lookups, ratings). No editar. |
| `types/person.ts`, `dashboard.ts`, `flights.ts`, `comisions.ts`, `papeleta.ts`, `event.ts` | Adaptadores/tipos de UI sobre los generados. |

### 5.8 `database/` — configuración de cliente

**Propósito.** Constantes/config del lado cliente (intervalos de polling de salud, flags de debug) que consume `DatabaseProvider`. No abre conexiones; es solo configuración.

| Archivo | Rol |
|---|---|
| `config.ts` | `DATABASE_CONFIG` (intervalo de health-check, logs de debug). |
| `index.ts` | Barrel de re-exportación. |

---

## Parte 6. Flujos completos de punta a punta

Aquí atamos las dos mitades. Sigue cada flujo con las Partes 4 y 5 al lado.

### 6.1 Lectura paginada: la tabla de personal

1. **Componente.** `Personnel.tsx` se monta y llama a `usePersonnel()`.
2. **Hook.** `usePersonnel` invoca `useApiPaginatedQuery<Person>({ path: "/persons", queryKey: queryKeys.personnel.list(escId, {}), transform: transformPersonnelFromDB })`.
3. **TanStack Query** comprueba si ya tiene esa key en caché y fresca. Si no, ejecuta la `queryFn`.
4. **`http.ts`** hace `fetch("/api/v1/persons", { credentials: "include" })` — la cookie de sesión viaja sola.
5. **Echo** pasa el request por los middlewares; `RequireAuth` valida la sesión y mete el `*User` en el contexto.
6. **Handler** `persons` saca `u.EscuadrillaID` y llama al **service**.
7. **Service** llama a la función **generada por sqlc**, que ejecuta el SELECT **filtrado por escuadrilla** sobre el **pool** pgx, y devuelve `{ items, total_count }`.
8. **Vuelta**: el JSON llega a `http`, `useApiPaginatedQuery` aplica `transform` (cruda → `Person[]`), cachea bajo la key y devuelve `{ data, isLoading, ... }`.
9. **Render**: la página pinta la tabla. Si el usuario filtra/busca, eso es **estado local** (no vuelve a pedir al servidor); el filtrado ocurre en el hook con `filteredPersonnel`.

### 6.2 Escritura con validación: alta de una persona

1. El usuario abre el drawer (`drawerOpen` = estado local) y rellena el formulario.
2. **react-hook-form + zod** validan en el cliente con `createPersonSchema(...)`. Si algo falla, se muestran errores y **no se envía nada**.
3. Al enviar, el hook arma el `payload` (fechas a `YYYY-MM-DD`, strings vacíos a `null`) y hace `http("POST", "/persons", { body })`.
4. **Echo**: `RequireAuth` (401 si no hay sesión) → `RequirePermission(PermAdministrativo)` (**403** si el nivel no está en la allow-list). Aquí está la **garantía real** de permisos.
5. **Handler** parsea el body, llama al **service**; el service **valida en servidor** (no se fía del cliente) y hace el INSERT. Si hay un error esperable (duplicado, inválido) devuelve un sentinel → **4xx** con mensaje seguro; si es inesperado → `return err` → **500 genérico** logueado.
6. **Vuelta**: si fue 2xx, el hook lanza un `toast.success` y **refresca** los datos (en este hook con `refetch()`; el patrón canónico con `useApiMutation` lo haría con `invalidateKeys`). La tabla se actualiza.

> Nota: `usePersonnel` usa `http(...)` directo + `refetch()` (patrón válido pero más manual). El patrón recomendado para escrituras nuevas es `useApiMutation` con `invalidateKeys` y `successMessage`, que centraliza toast + invalidación.

### 6.3 Login y ciclo de sesión

1. `Login.tsx` llama a `useUser().login(user, pass)` → `POST /auth/login` (con **rate-limit** por IP).
2. El backend verifica la contraseña con **argon2id**, crea una **sesión** (token aleatorio; en BD solo el SHA-256) y devuelve la cookie `HttpOnly` + el `userDTO`.
3. `UserProvider` guarda el usuario en estado → `isAuthenticated = true` → `ProtectedRoute` deja pasar.
4. En recargas posteriores, `UserProvider` llama a `refreshUser()` (`GET /auth/me`) **al montar**: si la cookie sigue válida, restaura la sesión sin re-login; un 401 se trata como "no hay sesión".
5. El backend **purga** sesiones caducadas en segundo plano (`purgeSessionsLoop`). `logout()` borra la sesión y limpia la cookie.

### 6.4 Lookups (datos de referencia)

Los catálogos (aeronaves, autoridades, roles...) se piden con `useLookupQuery` y `staleTime: Infinity`: se cargan una vez y se reutilizan toda la sesión, porque casi no cambian. Todos pegan a `GET /lookups/:name`, que el backend resuelve con un `switch` por nombre y filtra por escuadrilla donde aplica. Sus claves de caché también llevan `escuadrillaId`.

---

## Parte 7. Build, herramientas y generación de código

El proyecto se apoya en **generación de código** en dos puntos (SQL→Go y Go→TS) y en un `Makefile` que orquesta todo. Entender esta cadena es entender por qué "no se editan ciertos ficheros".

### 7.1 Las dos generaciones de código

```
queries/*.sql ──sqlc──▶ internal/queries/*.go        (make sqlc)
internal/domain/*/dto.go ──tygo──▶ web/src/types/generated/*.ts   (make types)
```

- **sqlc** (`sqlc.yaml`): lee el SQL de `queries/` y el esquema de `migrations/`, y emite Go tipado en `internal/queries/`. Config relevante: `sql_package: pgx/v5`, `emit_json_tags`, `emit_pointers_for_null_types` (columnas NULL → punteros `*T`), `emit_interface` (genera `Querier`). **Tras tocar un `.sql` → `make sqlc`.**
- **tygo** (`tygo.yaml`): lee **solo los `dto.go`** de cada dominio (no service/handlers) y emite los tipos TS en `web/src/types/generated/`. **Tras tocar un DTO Go → `make types`.** El CI falla si están desactualizados → el contrato Go↔TS nunca se desincroniza.

**Regla de oro:** nunca edites a mano `internal/queries/` ni `web/src/types/generated/`. Cambias la fuente (`.sql` o `dto.go`) y regeneras.

### 7.2 El `Makefile` (mapa de comandos)

| Target | Qué hace |
|---|---|
| `make run` | Arranca el servidor (`go run ./cmd/server`). Requiere `AETHER_DATABASE_URL`. |
| `make build` / `build-prod` | Binario de dev / binario de producción (frontend embebido, sin símbolos, `-trimpath`). |
| `make sqlc` / `make types` | Regenerar Go desde SQL / TS desde DTOs. |
| `make migrate-up` / `migrate-down` | Aplicar / revertir una migración (usa `$DATABASE_URL`). |
| `make load-sqlite` / `reload-sqlite` | Cargar datos productivos desde el `Aether.db` (SQLite) del repo privado. |
| `make db-reset` | DROP + CREATE de la BD en el contenedor Docker `aether-pg`. |
| `make dev-rebuild` | **Ciclo completo desde cero**: db-reset → migraciones de esquema → load-sqlite → migraciones de datos → bootstrap admin. |
| `make test` | `go test ./...` (con `AETHER_TEST_DATABASE_URL`, también los de integración). |
| `make fmt` / `vet` / `lint` | gofmt / go vet / golangci-lint. |
| `make theme-guard` | Falla si hay colores hardcodeados fuera de `theme.css`. |
| `make web-build` | `npm ci && npm run build` → `web/dist/` (lo que se embebe). |
| `make dist` | Tarball auto-contenido (binario + bootstrap + migrations + deploy) para producción. |

**Detalle clave del flujo de datos de dev:** las migraciones se aplican en **dos tandas** porque los datos productivos (0005) dependen de las personas, que se cargan desde SQLite *en medio*. Por eso `dev-rebuild` hace `migrate goto $SCHEMA_CUTOFF` (hasta la 4) → `load-sqlite` → `migrate up` (5+). El `bootstrap` final fija la contraseña de un usuario **que ya debe existir** en los datos cargados (de ahí la nota del README sobre `DEV_USER=jon` vs `admin`).

### 7.3 Build del frontend y embebido

`npm run build` = `tsc -b && vite build`. `tsc -b` es **también el typecheck** (no hay script `lint` separado en web): comprueba tipos y, si pasan, Vite empaqueta a `web/dist/`. Ese `dist/` se **versiona** y se incrusta en el binario con `//go:embed all:dist` (Parte 1.10). Por eso el `CLAUDE.md` recuerda: **reconstruye `web/dist/` antes de commitear cambios de frontend relevantes**, o el binario servirá una versión vieja.

### 7.4 Integración continua (`.github/workflows/ci.yml`)

Cuatro jobs en cada push/PR:

| Job | Qué verifica |
|---|---|
| **leak-guard** | Que **ningún archivo sensible (RGPD)** esté versionado (SQLite, seeds 0002/0004, mapeo de usuarios, cualquier `*.db`). Falla el build si aparece. |
| **theme-guard** | Que no haya colores hardcodeados fuera de `theme.css`. |
| **backend** | `go vet`, `golangci-lint`, `go build`, `go test` (con un **PostgreSQL efímero** como *service container* → corren los tests de integración), y que **tygo esté al día**. |
| **frontend** | `npm ci` + `npm run build` (typecheck + build de producción). |

### 7.5 Otros ficheros de configuración

| Archivo | Rol |
|---|---|
| `go.mod` / `go.sum` | Módulo y dependencias Go (pinned + checksums). |
| `web/package.json` / `package-lock.json` | Dependencias y scripts del frontend. |
| `.golangci.yml` | Configuración del linter Go. |
| `scripts/theme-guard.sh` | Script del guard de colores (con su allowlist de excepciones). |
| `.gitignore` | Incluye los artefactos RGPD para que no se cuelen. |
| `deploy/` | Unidad systemd y scripts de install/update con rollback (runbook en `deploy/README.md`). |
| `database-utils/` | Script Python de carga SQLite→Postgres, `requirements.txt`, plantillas de ejemplo. |

---

## Parte 8. Glosario

### Términos de Go

- **paquete (`package`)**: todo el código de una carpeta; visibilidad por mayúscula inicial.
- **`internal/`**: carpeta cuyo contenido solo puede importar el propio módulo.
- **struct**: agrupación de campos (≈ los datos de una clase, sin métodos dentro).
- **receptor**: el `(s *Service)` de un método; el `this` explícito de Go.
- **interfaz implícita**: un tipo la implementa por tener sus métodos, sin declararlo (`DBTX`).
- **puntero (`*T`, `&x`)**: referencia a un valor; `nil` = sin valor.
- **valor cero**: default garantizado de cada tipo (`0`, `""`, `false`, `nil`).
- **error como valor**: se devuelve y se comprueba con `if err != nil`; sin excepciones.
- **sentinel error**: error con nombre (`ErrNotFound`) para distinguir casos con `errors.Is`.
- **`%w` / `errors.Is` / `errors.As`**: envolver / comparar / extraer errores.
- **`defer`**: aplaza una llamada al `return` (limpieza garantizada).
- **slice (`[]T`) / map (`map[K]V`)**: lista dinámica / diccionario; `map[K]struct{}` = set.
- **`context.Context`**: propaga cancelación, deadlines y valores de petición.
- **goroutine (`go f()`) / channel (`chan`) / `select`**: concurrencia ligera y comunicación.
- **`go:embed`**: incrusta ficheros en el binario.
- **GUC**: variable de configuración de sesión de PostgreSQL (`set_config('aether.user_id', ...)`).
- **pgx / pgxpool / pgtype**: driver Postgres, pool de conexiones, tipos SQL (con `.Valid` para NULL).
- **sqlc**: genera Go tipado a partir de SQL.

### Términos de TypeScript / React

- **tipado estructural**: compatibilidad por forma, no por nombre.
- **`interface` / `type` / unión de literales (`"a" | "b"`)**: formas y enums ligeros.
- **genérico (`<T>`)**: parámetro de tipo.
- **`?.` / `??`**: optional chaining / nullish coalescing.
- **`Promise` / `async-await`**: valor futuro / azúcar de asincronía.
- **componente**: función que devuelve JSX (UI).
- **props**: datos de entrada de un componente (inmutables).
- **estado (`useState`)**: datos que cambian y disparan re-render.
- **hook (`useX`)**: función que engancha estado/efectos; los propios encapsulan lógica.
- **`useEffect`**: efecto secundario tras el render, con limpieza y dependencias.
- **`useRef`**: valor mutable que no provoca re-render.
- **TanStack Query**: caché de estado de servidor (query keys, `staleTime`, invalidación).
- **query key**: identificador de un dato en caché (aquí siempre con `escuadrillaId`).
- **mutación**: escritura que invalida keys para refrescar lecturas.
- **react-hook-form / zod**: formularios / validación de esquema (con `z.infer` para el tipo).
- **Radix / shadcn / CVA / `cn()`**: primitivas de UI / capa estilada / variantes / merge de clases.
- **Tailwind / token**: clases utilitarias / color semántico de `theme.css`.
- **tygo**: genera tipos TS desde DTOs Go.
- **barrel (`index.ts`)**: fichero que re-exporta lo público de una carpeta.
- **SPA**: aplicación de una sola página (la navegación no recarga).

### Términos del dominio

- **escuadrilla**: la unidad; eje de aislamiento de datos (`*_escuadrilla_fk`).
- **papeleta**: ficha/sesión de instrucción de vuelo.
- **comisión**: comisión de servicio (desplazamiento) de personal, con días asociados.
- **calificación (rating)**: aptitud de un tripulante por categoría (modelo, operacional, táctica general, liderazgo, mantenimiento).
- **esfuerzo**: métrica agregada de actividad (horas) por periodo.
- **DV**: tripulante de dotación de vuelo no piloto.
- **cupo**: reparto de horas de vuelo por autoridad.
- **adiestramiento / instrucción**: programas de entrenamiento (pilotos / dotaciones).
- **disponibilidad / ausencia**: quién está y por qué no (permiso, baja...).
- **festivo**: día festivo del calendario (catálogo global, sin escuadrilla).
- **nivel de permiso**: `Común` / `Operacional` / `Administrativo` / `Seguridad` (allow-list, sin jerarquía).
- **person_sk / _nk / _fk**: clave subrogada (surrogate) / clave natural (indicativo) / clave foránea.

---

> **Cómo seguir desde aquí.** Lee de corrido un dominio backend completo (`festivos` es el más corto) y su feature frontend (`personnel`), con este manual al lado. Cuando quieras *hacer* algo concreto (añadir un endpoint, una columna, un lookup), las recetas paso a paso están en `docs/ARQUITECTURA.md §11` y en `web/CLAUDE.md`. Las reglas que **no** debes saltarte (RGPD, código generado, migraciones, contrato de errores, permisos) están en el `CLAUDE.md` raíz.

### Cambio de escuadrilla de una persona (semántica "el pasado se queda donde se voló")

Una persona puede cambiar de escuadrilla. **No hay UI para ello** (la RLS-por-código encierra incluso al Superusuario en su escuadrilla): es un `UPDATE detall.person SET person_escuadrilla_fk` **manual en BD**. `person_escuadrilla_fk` es la escuadrilla **actual** (un único valor mutable). Reglas del modelo elegido:

- **El registro histórico se queda donde se generó.** Los datos "sellados" con su propia `*_escuadrilla_fk` (vuelos, comisiones, ausencias, calificaciones, papeletas, aeronaves…) **no se mueven nunca**.
- **La persona desaparece de la escuadrilla antigua.** Todos los informes basan su *roster* en `person_escuadrilla_fk` actual, así que tras el cambio la persona solo aparece en la nueva.
- **Horas de vuelo — vista doble** (`queries/hours.sql`, `NH90PeriodHours`, flag `$5` = modo "Totales"): por escuadrilla (`$5=false`) cuenta solo vuelos de la escuadrilla actual y horas extra del modelo propio en rango; Totales (`$5=true`) cruza escuadrillas e ignora el rango de fechas (histórico vitalicio), sumando horas extra de otros modelos. Es una exención acotada a la RLS-por-código: solo expone datos *propios* de personas del roster actual. Mismo patrón `$5` en `CtaHours`/`IftHours`.
- **Comisión y esfuerzo siguen a la persona y acumulan** (ya son person-centric). `operations.extra_hour` (tabla unificada de horas extra) es person-centric (sin `escuadrilla_fk`).