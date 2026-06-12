# Mejoras propuestas — análisis crítico (Fable 5)

> Análisis del estado del proyecto a 2026-06-12, tras revisar backend Go completo
> (main, auth, dominios, db), capa HTTP/query del frontend, migraciones, Makefile,
> .gitignore y `docs/MIGRACION.md` (hoy `CLAUDE.md` en la raíz del repo).

## Veredicto general

La arquitectura está **bien elegida y bien ejecutada en su esqueleto**: Echo + pgx +
sqlc + migraciones versionadas + SPA embebida es un stack idiomático, mantenible por
una sola persona y sin magia. La separación queries SQL → sqlc → service → handlers
es correcta, el scoping por escuadrilla en cada query es disciplinado, las sesiones
guardan solo el hash del token, y la separación repo público/privado por RGPD está
bien pensada. **No se necesitan cambios drásticos de arquitectura.** Lo que hay son
agujeros de madurez en seguridad, operación y verificación — y uno de ellos es grave.

---

## Problemas críticos

### 1. No existe autorización en el servidor (el más grave)

`PermissionLevel` se carga en login y se envía al frontend... y **nunca se comprueba
en el backend**. No hay un solo `if user.PermissionLevel` ni un middleware
`RequirePermission` en ningún dominio. Cualquier usuario autenticado —el de menor
rango— puede hacer `DELETE /flights/:id`, crear personas, editar calificaciones,
etc., con `curl` y su cookie. En una app de gestión militar con auditoría, que el
control de permisos viva solo en qué botones renderiza React es un fallo de
seguridad real, no teórico.

**Solución**: middleware `RequirePermission(level)` aplicado por ruta en cada
`Register()`.

### 2. Cero tests

No hay ni un `*_test.go` ni un test de frontend en ~30k líneas de código. Para
vuelos hay un insert transaccional sobre ~12 tablas hijas con parseo manual de
strings a floats — exactamente el tipo de código donde una regresión silenciosa
corrompe datos operativos.

**Solución**: empezar por tests de service contra un PostgreSQL efímero
(testcontainers-go o el contenedor de dev) para `flights.Insert`, auth y los
cálculos del dashboard. Sin esto, cada refactor es a ciegas.

### 3. Fuga de errores internos al cliente

Hay **98 sitios** que devuelven `echo.NewHTTPError(500, err.Error())`. Eso manda al
navegador mensajes de pgx con nombres de tablas, constraints y esquemas. Además es
boilerplate repetido en cada handler.

**Solución**: un `HTTPErrorHandler` centralizado en Echo que mapee sentinel errors
(`ErrNotFound`→404, `ErrDuplicate`→409, resto→500 genérico) y loguee el error real
con el request ID. Elimina las 98 fugas y la mitad del código de los handlers.

### 4. La "auditoría centralizada" está incompleta

- **No hay middleware de logging de requests.** Solo `Recover` y `RequestID` — pero
  el request ID no se escribe en ningún log, así que no correla nada. Un 500 en
  producción hoy no deja rastro de qué ruta, quién, ni por qué.
- **El endpoint `POST /logs` no existe.** `web/src/lib/logger.ts` lo llama, recibe
  404 y cae a `console.*` silenciosamente. Los logs del frontend que la migración
  prometía centralizar se están perdiendo.
- **`PurgeExpired` existe pero nadie lo llama**: la tabla `detall.session` crece
  para siempre. Una goroutine con ticker en `main.go` basta.

### 5. Operación del servidor descuidada

- **Sin graceful shutdown.** `e.Start()` bloquea y no hay manejo de señales; el doc
  dice "bloquea hasta SIGTERM" pero en realidad SIGTERM mata el proceso en seco,
  cortando requests en vuelo (y transacciones de insert de vuelos). Patrón estándar:
  `signal.NotifyContext` + `e.Shutdown(ctx)` con timeout.
- **Sin timeouts HTTP** (`ReadTimeout`/`WriteTimeout`) ni `BodyLimit`: una conexión
  colgada o un body de 2 GB se aceptan.
- **Configuración dispersa y con defaults peligrosos**: `os.Getenv` repartido entre
  `db/pool.go`, `auth/handlers.go` y `main.go`. El doc dice que existe
  `internal/config/` — no existe. Peor: si `AETHER_DATABASE_URL` está vacía,
  `pool.go` conecta en silencio a `postgresql://postgres:aether@localhost`. En
  producción eso debería ser un error fatal, no un fallback.
- **Sin rate limiting en `/auth/login`**: fuerza bruta de contraseñas sin fricción.
  Echo trae `middleware.RateLimiter`; son tres líneas.

---

## Problemas estructurales (importantes, no urgentes)

### Contrato API duplicado a mano

Los DTOs Go y los tipos TS de `web/src/types/` son copias paralelas sin nada que las
mantenga sincronizadas; un rename en Go rompe el frontend en runtime, no en compile
time. Con 77 endpoints, esta es la mayor fuente futura de bugs tontos. Opciones de
menor a mayor esfuerzo: generar tipos TS desde los structs Go (tygo), o definir
OpenAPI y generar ambos lados.

Además, el JSON de flights perpetúa el formato legacy de Rust (`gvnType_hour`,
camelCase mixto, floats como strings). La migración terminó; es el momento de
normalizar el contrato, no de fosilizarlo.

### Inconsistencias internas

- Auth usa SQL crudo con `pool.QueryRow` mientras todo lo demás usa sqlc, sin motivo
  aparente.
- `dashboard/` tiene la estructura buena (`dto.go`/`service.go`/`handlers.go`) pero
  `flights.go` son 1.089 líneas con DTOs + service + handlers + constantes mágicas
  en un solo archivo (comisiones 996, ratings 956). Aplicar el patrón de dashboard a
  los tres grandes.
- `auth.Validate()` hace 2 round-trips a BD por request (UPDATE + SELECT) cuando un
  solo query con JOIN basta — y escribe `last_seen_at` en cada request, convirtiendo
  cada GET en un write.

### Frontend

- Componentes de 700–850 líneas (`RegisterAbsenceDialog`, `ManageFlightDataDialog`)
  que mezclan fetch, estado de formulario y render — extraer la lógica a hooks por
  feature.
- Conviven dos patrones de datos (TanStack Query vs `http()` + `useState` manual,
  como en `FestivosDialog`): estandarizar en TanStack.
- El bug deliberadamente preservado de los endpoints intercambiados en ratings
  (`MaintenanceRatings` ↔ crew/not-crew) ya no tiene excusa: la migración terminó,
  hay que arreglarlo.

### Higiene de repo

- **No hay CI** (`.github` no existe): ni `go vet`, ni build, ni el check de "no se
  coló un archivo sensible" se ejecutan automáticamente — y ese último hoy depende
  de ojos humanos antes de cada push, que es justo donde fallan los humanos. Un
  workflow de GitHub Actions con build + vet + golangci-lint + un check que falle si
  aparece `Aether.db` o `0002_seed*.sql` en el diff protege del peor escenario
  (filtración RGPD).
- `web/dist/` y `*.tsbuildinfo` commiteados ensucian cada diff; lo limpio es
  buildear el frontend en CI/release, no versionar el artefacto.
- No hay linter Go configurado (el Makefile solo tiene `vet`).

---

## Orden de ataque propuesto — estado (2026-06-12)

1. ✅ **Autorización por nivel de permiso en backend** — `auth.RequirePermission`
   en todas las escrituras (commit f40db61).
2. ✅ **Error handler centralizado** — `internal/httpx/errors.go` (f40db61).
3. ✅ **Operabilidad** — request logging, `POST /logs`, purga de sesiones,
   graceful shutdown, timeouts, BodyLimit (f40db61).
4. ✅ **`internal/config` + rate limit en login** (f40db61).
5. ✅ **CI con build/lint/tests + leak-guard RGPD** (f40db61).
6. ✅ **Tests** — unitarios (auth, config, httpx, dashboard) y de integración
   contra BD efímera (`internal/testdb`; auth + festivos). El test de
   caducidad destapó un bug real de zonas horarias en sesiones, corregido
   con la migración 0006 (timestamptz).
7. Punto 7, parcialmente completado:
   - ✅ Fix del bug intercambiado de ratings crew/not-crew (13ed76a).
   - ✅ Dominios gigantes partidos a dto/service/handlers (flights,
     comisiones, ratings) (13ed76a).
   - ✅ Auth unificado con sqlc; `Validate` en 1 round-trip (e4fc94c).
   - ✅ Generación de tipos TS con tygo (`make types` + check en CI);
     `types/dashboard.ts` adoptado como patrón (e4fc94c).
   - ✅ `FestivosDialog` estandarizado a TanStack Query.
   - ✅ `RegisterAbsenceDialog` (855) partido: modelo en
     `availability/absences.ts`, lógica en `hooks/useAbsenceDialog.ts`,
     componente solo render (bbe981d).
   - ✅ `ManageFlightDataDialog` (762) partido en tabs por archivo bajo
     `dialogs/manage-flight-data/` (0fab533).
   - ✅ Tipos generados adoptados también en `types/comisions.ts` y en la
     entrada de `transformFlightsFromDB` (antes `any[]`); eliminado el hook
     muerto `useRatings` y utilidades sin uso de `features/ratings`
     (~370 líneas) (bbe981d).
   - ✅ Cola de componentes grandes completada (3e68d4a):
     `GeneralTacticalRatings` (744 → 177 + hook + tooltip),
     `Disponibilidad` (697 → 421 + `useDisponibilidad`),
     `RegisterComisionForm` (686 → 454 + `useComisionForm`),
     `Personnel` (575 → 370 + `usePersonnel`). Refactor mecánico
     (la lógica se movió sin reescribirse); verificado con `tsc -b`,
     build de Vite y **repaso visual de las 4 pantallas con la app
     corriendo (2026-06-12): funcionan correctamente**.

**El plan está completo.** No queda nada pendiente del análisis original.

---

## Lo que está bien (y no hay que tocar)

- Stack Echo + pgx + sqlc + golang-migrate: idiomático, sin magia, mantenible en
  solitario.
- Separación por capas (SQL → sqlc → service → handler) y por dominios.
- Scoping por escuadrilla aplicado de forma disciplinada en las queries.
- Sesiones: token aleatorio de 32 bytes, solo el hash SHA-256 en BD, cookie
  HttpOnly + SameSite=Lax, argon2id para contraseñas, respuesta genérica en login
  que no filtra si el usuario existe.
- Triggers de invariantes y auditoría (`tr_audit_flight` con GUCs de usuario/IP).
- Separación repo público/privado por RGPD con symlinks y plantillas `.example`.
- SPA embebida con `go:embed`: despliegue de un solo binario con rollback automático
  en `update.sh`.
- Documentación (`MIGRACION.md`, hoy `CLAUDE.md`) extensa y útil — aunque tenía
  drift: mencionaba `internal/config/` y `POST /logs` que no existían; corregido
  al implementar los puntos 3 y 4.
