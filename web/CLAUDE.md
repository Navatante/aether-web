# Frontend (web/)

Detalle operativo del frontend. Las 5 convenciones canónicas (componentes = solo render, modelo por feature, un archivo por tab, tipos generados, datos por TanStack Query) están en el `CLAUDE.md` raíz.

## Comandos

- `npm run dev` — Vite en `:5173`, proxy `/api` → `:8080` (el backend tiene que estar corriendo).
- `npm run build` — `tsc -b && vite build`. Es también el typecheck: no hay script `lint` separado.
- `web/dist/` está versionado (se embebe en el binario Go): reconstruir antes de commitear cambios de frontend relevantes.

## Mapa de src/

| Carpeta | Qué contiene |
|---|---|
| `app/App.tsx` | Composición raíz de providers + rutas (`ProtectedRoute`, `MainLayout`). |
| `providers/` | `UserProvider` (sesión, `useUser`, `useHasPermission`, `useEscuadrilla`), `DatabaseProvider` (poll a `/health`), `ThemeProvider`. |
| `features/<feature>/` | Una carpeta por feature: `components/` (y `components/dialogs/`), `hooks/` (lógica de páginas/diálogos). |
| `shared/` | Hooks compartidos entre features: `useLookups.ts`, `useConfirmationDialog.ts`. |
| `components/` | Primitives de UI (Radix/shadcn). No llevan lógica de datos. |
| `lib/` | `http.ts` (wrapper fetch, prepende `/api/v1`), `apiQuery.ts` (hooks TanStack), `queryKeys.ts` (factory de claves), `queryClient.ts`, `logger.ts` (POST /logs). |
| `types/` | Adaptadores finos sobre `types/generated/` (tygo, **no editar**) + tipos puramente de UI. |

## Capa de datos

| Hook (`lib/apiQuery.ts`) | Para qué |
|---|---|
| `useApiQuery<T>` | Lecturas. Acepta `{ enabled, query }`. |
| `useApiPaginatedQuery<T, TRaw>` | Respuestas `{ items, total_count }`; `TRaw` tipa el `transform`. |
| `useApiMutation<TData, TVars>` | POST/PUT/DELETE con `invalidateKeys` + toasts de éxito/error automáticos. |
| `useLookupQuery` | Lookups con `staleTime: Infinity` (úsalo vía los hooks de `shared/hooks/useLookups.ts`). |

Todas las claves de `queryKeys` incluyen `escuadrillaId` (aislamiento de caché coherente con la RLS del backend). Tras una mutación, invalida con el prefijo `queryKeys.<feature>.all(escId)`.

`useApiQuery`/`useApiPaginatedQuery` **anexan automáticamente** la identidad del fetch (`method`, `path`, `query`, `body`) al final de tu `queryKey`, así que la caché siempre refleja qué se pide aunque olvides un param (defensa en profundidad, no requisito de corrección). Sigue metiendo los params en tu clave igualmente: hace las claves legibles y mantiene la invalidación por prefijo. Como se anexa al final, tu `queryKey` sigue siendo prefijo y `invalidateQueries({ queryKey: queryKeys.<feature>.all(escId) })` casa igual.

Los errores HTTP de mutaciones ya los notifica el toast de `useApiMutation`: no añadas toasts duplicados en el componente.

## Receta: añadir un lookup nuevo

1. Backend: query en `queries/lookups.sql` → `make sqlc` → DTO + método de service → `case "<nombre>"` en `internal/domain/lookups/handlers.go`.
2. `make types` si añadiste DTOs.
3. Clave en `queryKeys.lookups` (`lib/queryKeys.ts`).
4. Hook en `shared/hooks/useLookups.ts`:
   ```ts
   export function useFuelTypes() {
       return useLookup<FuelTypeLookup>('fuel-types', queryKeys.lookups.fuelTypes);
   }
   ```

## Gráficos de estadísticas (patrón canónico)

Charts con recharts alimentados por un endpoint de stats con rango de fechas. Separación en **3 capas** — no metas todo en la página. Referencia completa: `features/hours/**`.

1. **Andamiaje genérico** `shared/components/charts/StatsChartCard.tsx`: `Card` + cabecera (`title`/`description`) + el triple estado **carga / error / vacío**. Agnóstico de recharts y del shape de datos; el chart concreto entra como `children`. Reutilízalo en **todo** chart de stats (no recrees el spinner / bloque de error / "sin datos" a mano).
2. **Chart concreto** en `features/<feature>/components/<Nombre>Chart.tsx`: dueño de su `chartConfig`, leyenda, tooltip y los `<Bar>/<Line>/…`. Recibe `data` por props y **nada más** (sin fetching). Ej.: `NH90HoursChart`.
3. **Hook de datos** en `features/<feature>/hooks/use<Nombre>.ts`: estado del rango + `useApiQuery` + derivados (memoizados). Parametriza por filtros (`personRol`, `includePrevious`, …) para reutilizar la misma vista con distintos datos. Ej.: `useHorasVuelo`.

La **página** queda como composición solo-render (~70 líneas):
```tsx
const { loading, errorMsg, chartData, enrichedChartData, startDate, endDate, handleDateRangeChange }
    = useHorasVuelo({ personRol: 'Piloto', includePrevious: viewMode === 'totals' })
// ...
<SegmentedDateRangeAether onDataReceived={handleDateRangeChange} currentDateFrom={startDate} currentDateTo={endDate} />
<StatsChartCard title="…" description="…" isLoading={loading} error={errorMsg} isEmpty={chartData.length === 0}>
    <NH90HoursChart data={enrichedChartData} />
</StatsChartCard>
```

**Reglas de oro (errores reales que esto evita):**
- **Datos por `useApiQuery`, nunca `http()`+`useState`** (regla 5). El rango lo emite `SegmentedDateRangeAether` (`shared/components/common`) vía `onDataReceived: (StatsParams) => void`; tradúcelo a query params en el hook. Mete los query params en la `queryKey` → TanStack refetchea solo y cachea por combinación (y por escuadrilla).
- **Estado inicial = default del selector** (`ultimos-30-dias`) para no disparar un fetch extra en el montaje.
- **Separa estado-de-rango de los query-params finales**: el rango es estado mutable (lo cambia el selector); rol/flags son props que se mezclan vía `useMemo`. Así un cambio de prop refetchea sin tocar el estado del rango.
- **Tipos del backend, no a mano**: el endpoint devuelve un DTO Go → split en `dto.go`, añádelo a `tygo.yaml`, `make types`, y consume el tipo generado (adaptador fino en `types/`). No re-declares interfaces que espejen el JSON.
- **Fechas**: el backend devuelve `YYYY-MM-DD`; formatéalas con `formatDateDisplay` (export de `shared/components/common`), no con un helper ad-hoc.
- **Colores**: solo tokens (`var(--color-…)`, `var(--foreground)`); en recharts el `fill`/`stroke` van como `var(--token)`. Pasa `make theme-guard`.

## Tablas (responsividad — patrón canónico)

La app es **solo navegador de escritorio**; "responsivo" = comportarse bien en cualquier ancho de ventana (incl. split-screen), no maquetar para móvil. **Todas las tablas anchas usan el archetipo "container-scroll"**: la zona de tabla scrollea (X/Y) dentro de un contenedor de altura acotada, con cabecera (y 1ª columna en matrices) congeladas; la cabecera y los controles quedan fijos arriba. **No** uses el viejo patrón page-scroll (`overflow-y-auto` en la raíz + `StickyTableHeader offset="topbar"`).

Piezas compartidas en `shared/components/common/`: `PageTableContainer`, `StickyTableHeader`, `TableRow`, `DetailsRow`, y `stickyColumn.ts` (`STICKY_CORNER`, `stickyFirstColClass`).

**Esqueleto (lista — pocas columnas; ref: `flights/pages/Flights.tsx`, `personnel/pages/Personnel.tsx`):**
```tsx
<div className="h-full p-3 sm:p-6 pb-8 flex flex-col">                 {/* p-3 sm:p-6 = respira en estrecho */}
  <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
    <div className="… flex-shrink-0">{/* título */}</div>
    <PageControls className="flex-shrink-0">{/* filtros */}</PageControls>
    <PageTableContainer className="flex-1 flex flex-col min-h-0">
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-[760px]" role="table">  {/* min-w → scroll antes de aplastar */}
          <StickyTableHeader> … </StickyTableHeader>             {/* offset="none" (por defecto) */}
          <tbody>{rows.map((r, idx) => <TableRow index={idx} …>…</TableRow>)}</tbody>
        </table>
      </div>
      {/* paginación: flex flex-wrap … para que no desborde */}
    </PageTableContainer>
    {/* contador u otros: fuera del scroll, flex-shrink-0 */}
  </div>
</div>
```

**Matriz (muchas columnas, p. ej. personal × algo; ref: `training/**`, `availability/pages/Disponibilidad.tsx`, `ratings/components/RatingTable.tsx`):** igual, pero **congela también la 1ª columna**:
- `PageTableContainer className="flex-1 overflow-auto"` (sin div interno extra).
- `<thead>` ⇒ siempre el componente `StickyTableHeader` (nunca `<thead className="sticky…">` a mano).
- Celda esquina sup-izq: ``className={`… ${STICKY_CORNER}`}``.
- Celda de cuerpo de la 1ª columna: `className={stickyFirstColClass(idx, "p-4 …")}`.
- Capas z resultantes: cuerpo normal auto · 1ª col `z-10` · cabecera `z-20` · esquina `z-30`.

**Reglas de oro (errores reales que esto evita):**
- **Fondo opaco en celdas congeladas**: usa `bg-table-sticky-even/odd` (vía `stickyFirstColClass`) y `bg-table-header` en la esquina — los `bg-table-row-*` son **traslúcidos en dark** y dejan ver lo que scrollea por detrás.
- **`z-5` no existe** en Tailwind (escala 0/10/20/30/40/50): usa el helper, no inventes z-index.
- Para que el scroll interno funcione, la cadena de flex necesita `flex-1` + `min-h-0` en cada nivel hasta el contenedor; los hermanos no-tabla van `flex-shrink-0`.

## Colores y theming

- **Fuente única de verdad**: `src/app/theme.css` — tokens OKLCH en `:root` (claro) y `.dark` (oscuro), mapeados a clases Tailwind vía `@theme inline`. El modo oscuro lo gestiona `ThemeProvider` (clase `.dark` en `<html>`); nunca dual-codees colores con `dark:` a mano.
- **Prohibido hardcodear colores** (hex/rgb/oklch o clases de paleta tipo `text-gray-400`, `bg-red-500`, `text-white`): usa tokens semánticos (`text-muted-foreground`, `bg-danger-muted`, `text-success`, `bg-table-header`, `bg-role-pilot`…). Para estilos inline o recharts: `var(--token)` (p. ej. `var(--effort-high)`, `var(--absence-permiso)`).
- Si necesitas un color nuevo, añade el token en `theme.css` (`:root` + `.dark` + mapeo `--color-*`).
- **Excepciones documentadas**: `features/ratings/utils/colors.ts` (COLOR_PALETTE categórica), `shared/components/common/glassColors.ts` y `GlassProgressBar*` (animación decorativa), `components/ui/chart.tsx` (defaults de recharts), `components/ui/button.tsx`/`badge.tsx` (variants stock de shadcn), scrims `bg-black/NN` en overlays.
- Guard: `make theme-guard` (también corre en CI). Allowlist en `scripts/theme-guard.sh`.

## Permisos en la UI

`useHasPermission(...)` solo oculta botones: es cosmético. La garantía real es el 403 del backend (`RequirePermission`). Al añadir una acción de escritura, replica en la UI exactamente la allow-list de la ruta (sin jerarquía entre niveles).