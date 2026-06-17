# Generación de documentación PDF mensual

Diseño para generar, con un clic, un documento PDF **multipágina** y **mensual** nutrido desde la
base de datos. Este documento explica **por qué** se elige el enfoque, **cómo** encaja en el stack
de Aether-Web y **qué pasos** seguir para implementarlo y para añadir nuevos informes en el futuro.

> Estado: documento de diseño. El código aún no existe — esta guía dirige la implementación.

---

## 1. Objetivo y decisión

**Objetivo.** Desde la app, el usuario pulsa un botón "Generar PDF", elige un **mes** en un diálogo,
y obtiene un documento PDF de varias páginas con información del **mes completo** seleccionada de
**varios dominios** de la BD (horas, calificaciones, comisiones, disponibilidad, adiestramiento,
resumen de operaciones…). El usuario controla explícitamente qué va en cada página.

**Decisión: ruta de impresión del navegador** (`window.print()` + CSS `@media print`).

Una página React dedicada renderiza el documento con un layout pensado para papel; el botón llama a
`window.print()` y el navegador ofrece "Guardar como PDF". Los datos se obtienen reutilizando los
endpoints/Services ya existentes (TanStack Query), sin tocar el backend.

### Por qué este enfoque (y no los otros)

| Enfoque | Veredicto | Motivo |
|---|---|---|
| **Ruta de impresión del navegador** (elegido) | ✅ | Cero dependencias nuevas. Reutiliza componentes, tokens de tema y `recharts` (sus SVG se imprimen). No toca el backend. Encaja con la filosofía minimalista del proyecto (4 deps Go directas, sin libs de PDF en npm). El más rápido de implementar y mantener para un único desarrollador. |
| `@react-pdf/renderer` (cliente) | ❌ | Descarga directa sin diálogo, pero añade una dependencia pesada y **obliga a reimplementar los gráficos** (recharts no se renderiza dentro de react-pdf) y un sistema de estilos paralelo. |
| Go server-side (`maroto`/`gofpdf`) | ❌ | Maquetar PDF en Go es tedioso, los gráficos son difíciles y rompe la filosofía de dependencias mínimas del backend. |
| Go + headless Chrome (`chromedp`/`rod`) | ❌ | Alta fidelidad, pero exige Chromium instalado junto al binario en producción (systemd). Demasiado peso operativo para una intranet de un solo dev. |

**Coste asumido:** el diálogo de impresión del navegador es inevitable (ver [§6](#6-limitaciones-y-notas-de-impresión)).

---

## 2. Arquitectura propuesta

### Flujo de un clic

```
Página origen (botón "Generar PDF")
        │  abre MonthPickerDialog → usuario elige mes/año
        ▼
window.open(`/print/<reportId>?month=MM&year=YYYY&autoprint=1`, "_blank")
        ▼
Ruta /print/:reportId  (dentro de ProtectedRoute, FUERA de MainLayout → sin sidebar/topbar)
        │  reportRegistry[reportId] → { Document, useData }
        ▼
useData({ month, year })  → deriva rango [1..últimoDía] → varios useApiQuery (varios dominios)
        │  estado de carga/error agregado
        ▼
<PrintDocument>  →  <Document data=... />  (composición de <PrintPage> multipágina)
        ▼
autoprint: al resolver los datos → window.print()  →  "Guardar como PDF"
        │
        └─ onafterprint → window.close()
```

### Por qué la ruta va **fuera** de `MainLayout`

En `web/src/app/App.tsx`, `ProtectedRoute` (sesión) envuelve a `MainLayout`, que pinta `Topbar` +
`AppSidebar` + `<Outlet>`. Si la ruta de impresión colgara de `MainLayout`, el PDF arrastraría la
barra lateral y la superior. La solución es declararla **hermana** de `MainLayout` dentro de
`ProtectedRoute`: mantiene sesión y caché de TanStack Query, pero sin el chrome de la app.

```tsx
// web/src/app/App.tsx  (dentro de <Route element={<ProtectedRoute />}> )
<Route path="/" element={<MainLayout />}>
    {/* ...rutas actuales... */}
</Route>
<Route path="print/:reportId" element={<PrintRoute />} />   {/* nueva, sin MainLayout */}
```

`PrintRoute` se carga `lazy` (como el resto de páginas con recharts) para aislar el chunk de
`recharts` fuera del bundle principal.

### Árbol de archivos (feature `reports`)

```
web/src/
├── app/
│   ├── App.tsx                         # + ruta /print/:reportId
│   └── print.css                       # CSS de impresión (@page + @media print)
└── features/reports/
    ├── index.ts                        # API pública de la feature
    ├── reportRegistry.ts               # reportId → { title, Document, useData, parseParams }
    ├── PrintRoute.tsx                   # resuelve params + registry, monta PrintDocument
    ├── components/
    │   ├── PrintDocument.tsx           # marco A4: cabecera/pie, barra .no-print, estados
    │   ├── PrintPage.tsx               # primitiva: UNA página A4 con salto garantizado
    │   └── MonthPickerDialog.tsx       # diálogo de selección de mes (reutilizable)
    ├── documents/
    │   └── MonthlyReportDocument.tsx   # primer informe: compone N <PrintPage>
    └── hooks/
        └── useMonthlyReport.ts         # agrega datos de varios dominios para el mes
```

### Documento multipágina: el autor controla cada página

El documento es una **secuencia explícita de páginas**. La primitiva `PrintPage` es una página A4
con salto de página garantizado; el `Document` compone tantas como quiera, decidiendo qué va en cada
una. Los datos de cada página pueden venir de dominios distintos (todos agregados por el hook).

```tsx
// features/reports/documents/MonthlyReportDocument.tsx  (solo-render; recibe `data` por props)
export function MonthlyReportDocument({ data }: { data: MonthlyReportData }) {
    return (
        <>
            <PrintPage>                       {/* Página 1: portada */}
                <ReportCover month={data.month} year={data.year} escuadrilla={data.escuadrilla} />
            </PrintPage>

            <PrintPage>                       {/* Página 2: resumen de operaciones (dashboard) */}
                <OperationsSummary resumen={data.resumen} />
            </PrintPage>

            <PrintPage>                       {/* Página 3: horas por tripulante (hours) */}
                <HoursTable rows={data.hours} />
            </PrintPage>

            <PrintPage>                       {/* Página 4: calificaciones (ratings) */}
                <RatingsMatrix people={data.ratings} />
            </PrintPage>

            {/* ...tantas páginas como requiera el informe... */}
        </>
    );
}
```

```tsx
// features/reports/components/PrintPage.tsx
export function PrintPage({ children }: { children: React.ReactNode }) {
    return <section className="print-page">{children}</section>;  // .print-page → break-after: page
}
```

---

## 3. Pasos de implementación

1. **`web/src/app/print.css`** — reglas `@page` + `@media print` (ver [§5](#5-css-de-impresión)).
   Importarlo desde `PrintDocument.tsx`.
2. **Feature `features/reports/`**:
   - `PrintPage.tsx` (primitiva de página) y `PrintDocument.tsx` (marco A4 + cabecera/pie +
     barra de acciones `.no-print` con botón "Generar PDF" + estados carga/error/vacío).
   - `MonthPickerDialog.tsx` (Radix `Dialog` + selectores mes/año, por defecto el mes actual).
   - `reportRegistry.ts` con la primera entrada.
   - `documents/MonthlyReportDocument.tsx` y `hooks/useMonthlyReport.ts`.
   - `PrintRoute.tsx` (lee `useParams`/`useSearchParams`, resuelve el registry, gestiona
     `autoprint`).
   - `index.ts`.
3. **Ruta** `print/:reportId` en `web/src/app/App.tsx`, hermana de `MainLayout`, dentro de
   `ProtectedRoute`, cargada con `lazy`.
4. **Disparo desde la página origen** — botón "Generar PDF" que abre `MonthPickerDialog`; al
   confirmar, `window.open('/print/<id>?month=MM&year=YYYY&autoprint=1', '_blank')`.

### Selección de mes y rango del mes completo

El diálogo emite `{ month, year }`. El hook deriva el rango `[primer día, último día]` y lo pasa a
**todas** las queries (mismo rango para horas, comisiones, disponibilidad…), de modo que el informe
siempre cubre el mes completo:

```ts
// dentro de useMonthlyReport.ts
const start = new Date(year, month - 1, 1);
const end   = new Date(year, month, 0);              // día 0 del mes siguiente = último del actual
const dateFrom = toISODate(start);                   // 'YYYY-MM-DD'
const dateTo   = toISODate(end);

// varios dominios, mismo rango — cada uno con su queryKey (incluye escuadrillaId + params)
const ops      = useApiQuery<DashboardDynamicStats>('POST', '/dashboard/dynamic-stats',
    { body: { range_type: 'custom', date_from: dateFrom, date_to: dateTo } });
const hours    = useApiQuery<HoursResult>('GET', '/hours/nh90-period',
    { query: { date_from: dateFrom, date_to: dateTo } });
const ratings  = useApiQuery<RatingsResult>('GET', '/ratings/model');
// ...comisiones, disponibilidad (month/year), training, etc.

const isLoading = ops.isLoading || hours.isLoading || ratings.isLoading /* ... */;
const error     = ops.error ?? hours.error ?? ratings.error /* ... */;
const data = !isLoading && !error
    ? { month, year, resumen: ops.data, hours: hours.data, ratings: ratings.data /* ... */ }
    : null;
```

> Reutiliza los endpoints existentes (`dashboard`, `hours`, `ratings`, `comisiones`,
> `availability`, `training`). **No hace falta tocar el backend.** Verifica el path/forma exacta de
> cada endpoint en `internal/domain/<dominio>/handlers.go` y su DTO antes de cablearlo.

### Autoprint

```tsx
// PrintRoute.tsx — disparar la impresión cuando los datos están listos
const [params] = useSearchParams();
const autoprint = params.get('autoprint') === '1';
// data viene del hook del registry
useEffect(() => {
    if (autoprint && data) {
        const onAfter = () => window.close();
        window.addEventListener('afterprint', onAfter, { once: true });
        window.print();
        return () => window.removeEventListener('afterprint', onAfter);
    }
}, [autoprint, data]);
```

---

## 4. Receta: añadir un informe nuevo

Análoga a la receta de lookups de `web/CLAUDE.md`. Tres pasos:

1. **Documento** — `features/reports/documents/<Nombre>Document.tsx`: componente solo-render que
   compone sus `<PrintPage>` y recibe `data` por props.
2. **Hook de datos** — `features/reports/hooks/use<Nombre>Report.ts`: recibe `{ month, year }`,
   deriva el rango y agrega los `useApiQuery` de los dominios que necesite en un único `data`.
3. **Registro** — una entrada en `reportRegistry.ts`:
   ```ts
   export const reportRegistry = {
       'monthly': {
           title: 'Informe mensual',
           Document: MonthlyReportDocument,
           useData: useMonthlyReport,
       },
       // 'nuevo-informe': { title, Document, useData },
   } as const;
   ```

El botón de disparo en la página origen solo cambia el `reportId` de la URL.

---

## 5. CSS de impresión

`web/src/app/print.css` (importado por `PrintDocument.tsx`):

```css
@page {
    size: A4;
    margin: 16mm 14mm;
}

/* Una página del documento */
.print-page {
    break-after: page;          /* cada PrintPage fuerza salto */
}
.print-page:last-child {
    break-after: auto;
}

@media print {
    /* Ocultar todo lo que no es documento (barra de acciones, etc.) */
    .no-print { display: none !important; }

    /* Respetar colores de gráficos y celdas */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Repetir cabecera de tabla en cada página y no partir filas/bloques */
    thead { display: table-header-group; }
    tr, .avoid-break { break-inside: avoid; }
}
```

- **Control de página por composición**, no por CSS suelto: el autor decide los cortes añadiendo
  `<PrintPage>`. `.avoid-break` para bloques concretos que no deben partirse a mitad.
- **Tema claro en impresión**: forzar las variables de tema claro dentro de `@media print` para
  ahorrar tinta y mejorar contraste, sin dual-codear colores en cada componente.
- **Respeta los tokens** de `web/src/app/theme.css` (nada de hex/rgb/clases de paleta). Debe pasar
  `make theme-guard` (corre en CI). Si necesitas un color nuevo, añádelo como token.

---

## 6. Limitaciones y notas de impresión

- **Diálogo del navegador inevitable**: el usuario confirma "Guardar como PDF". No es una descarga
  100% silenciosa (eso requeriría `@react-pdf/renderer` o headless Chrome, descartados en §1).
- **Cabeceras/pies y numeración nativas limitadas**: las del sistema operativo (fecha, URL) son
  pobres y poco configurables. Recomendación: **desactivar "Encabezados y pies de página"** en el
  diálogo del navegador y usar la cabecera/pie del propio `PrintDocument` (logo, escuadrilla, mes,
  título). La numeración "página X de Y" con CSS `@page`/contadores tiene soporte irregular; si se
  necesita exacta, valorar a futuro un fallback.
- **Navegador recomendado: Chromium** (mejor soporte de `break-*` y `print-color-adjust`).
- **`recharts` en impresión**: usar ancho/alto **fijos** (evitar `ResponsiveContainer`, que mide 0
  fuera de pantalla) e `isAnimationActive={false}` para que el SVG esté pintado antes de
  `window.print()`.

---

## 7. Verificación

1. `cd web && npm run dev` con el backend en `:8080` (`make run`, requiere `AETHER_DATABASE_URL`).
2. Login → en la página origen pulsar **"Generar PDF"** → elegir mes en el diálogo.
3. Se abre `/print/<id>?month=MM&year=YYYY` con el **layout limpio sin sidebar/topbar** y datos del
   **mes completo**; el diálogo de impresión del navegador permite **"Guardar como PDF"**.
4. En la previsualización de impresión comprobar: **saltos de página** correctos (una sección por
   `PrintPage`), **repetición de cabecera de tabla** en tablas largas y **render de gráficos**.
5. Antes de commitear: `cd web && npm run build` (typecheck) y `make theme-guard`. Recuerda que
   `web/dist/` se embebe en el binario: reconstruir el frontend antes de commitear cambios
   relevantes.

---

## Referencias en el código

- Routing y `ProtectedRoute`/`MainLayout`: `web/src/app/App.tsx`,
  `web/src/shared/components/layout/MainLayout.tsx`.
- Capa de datos (hooks, queryKeys, reglas): `web/CLAUDE.md`, `web/src/lib/apiQuery.ts`,
  `web/src/lib/queryKeys.ts`.
- Escuadrilla de la sesión para la cabecera: `useEscuadrilla()` en
  `web/src/providers/UserProvider`.
- Endpoints y DTOs reutilizables: `internal/domain/{dashboard,hours,ratings,comisiones,availability,training}/`.
- Tokens de color y guard: `web/src/app/theme.css`, `make theme-guard`.
- Patrón de exportación existente (CSV client-side) como precedente:
  `web/src/features/personnel/hooks/usePersonnel.ts` (`exportToCSV`).
```
