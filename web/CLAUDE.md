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

## Permisos en la UI

`useHasPermission(...)` solo oculta botones: es cosmético. La garantía real es el 403 del backend (`RequirePermission`). Al añadir una acción de escritura, replica en la UI exactamente la allow-list de la ruta (sin jerarquía entre niveles).