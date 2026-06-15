// TanStack Query hooks contra la API HTTP.
// Autenticación por cookie (gestionada por UserProvider). Los hooks se
// deshabilitan hasta que el user esté cargado.

import {
    useQuery,
    useMutation,
    useQueryClient,
    type QueryKey,
    type UseMutationOptions,
} from "@tanstack/react-query";
import { http, type HttpMethod, type HttpOptions } from "./http";
import { useUser } from "@/providers";
import { toast } from "sonner";

// ============================================================================
// useApiQuery — lecturas
// ============================================================================

export interface UseApiQueryOptions<T> {
    /** Override staleTime para esta query */
    staleTime?: number;
    /** Condición adicional para habilitar la query (combinada con auth check) */
    enabled?: boolean;
    /** Transforma la respuesta cruda */
    select?: (data: T) => T;
    /** Body en lugar de query params (para endpoints POST/PUT que devuelven datos) */
    body?: unknown;
    /** Query params */
    query?: HttpOptions["query"];
    /** Si true, no requiere auth (raro) */
    public?: boolean;
}

/**
 * Lectura tipada contra la API.
 *
 * @example
 *   useApiQuery<DashboardStaticStats>('GET', '/dashboard/static-stats', { query: { ... } }, queryKeys.dashboard.static)
 */
export function useApiQuery<T>(
    method: HttpMethod,
    path: string,
    options: UseApiQueryOptions<T> | undefined,
    queryKey: QueryKey,
) {
    const { isAuthenticated, loading: userLoading } = useUser();
    const enabled = (options?.public || (!userLoading && isAuthenticated)) && (options?.enabled ?? true);

    // La clave incluye la identidad del fetch (method/path/query/body) además de
    // la queryKey del llamador: así la caché siempre refleja lo que se pide,
    // aunque el llamador olvide algún param. Se anexa al final → la queryKey del
    // llamador sigue siendo prefijo y la invalidación por prefijo sigue casando.
    return useQuery<T>({
        queryKey: [...queryKey, method, path, options?.query, options?.body, ...(enabled ? [] : ["disabled"])],
        queryFn: ({ signal }) => http<T>(method, path, {
            body: options?.body, query: options?.query, signal,
        }),
        enabled,
        staleTime: options?.staleTime,
        select: options?.select,
    });
}

// ============================================================================
// useApiPaginatedQuery — { items, total_count }
// ============================================================================

export interface ApiListResult<T> {
    items: T[];
    total_count?: number;
}

export interface UseApiPaginatedQueryOptions<TData, TRaw = unknown> {
    method?: HttpMethod;            // default GET
    path: string;
    query?: HttpOptions["query"];   // GET params
    body?: unknown;                 // si method != GET
    queryKey: QueryKey;
    transform?: (raw: TRaw[]) => TData[];
    enabled?: boolean;
    showToastOnError?: boolean;
}

/**
 * Paginado: espera respuesta { items: [...], total_count }.
 *
 * @example
 *   useApiPaginatedQuery<FlightItem>({
 *       path: '/flights', query: { limit: 20, offset: 0 },
 *       queryKey: queryKeys.flights.list(params),
 *   })
 */
export function useApiPaginatedQuery<TData = unknown, TRaw = unknown>(opts: UseApiPaginatedQueryOptions<TData, TRaw>) {
    const { method = "GET", path, query, body, queryKey, transform, enabled = true, showToastOnError = true } = opts;
    const { isAuthenticated, loading: userLoading } = useUser();
    const queryEnabled = !userLoading && isAuthenticated && enabled;

    // Identidad del fetch anexada a la queryKey del llamador (ver useApiQuery).
    // `transform` se excluye a propósito: es un post-procesador puro (no cambia
    // QUÉ se pide) y meter una función rompería la estabilidad de la clave (su
    // identidad cambia en cada render → refetch infinito).
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const q = useQuery<{ items: TData[]; totalCount: number }>({
        queryKey: [...queryKey, method, path, query, body, ...(queryEnabled ? [] : ["disabled"])],
        queryFn: async ({ signal }) => {
            const res = await http<ApiListResult<TRaw>>(method, path, { query, body, signal });
            const raw = res.items ?? [];
            const total = res.total_count ?? raw.length;
            // Sin transform, se asume TRaw = TData (el caso por defecto).
            const items = transform ? transform(raw) : (raw as unknown as TData[]);
            return { items, totalCount: total };
        },
        enabled: queryEnabled,
        meta: { showToastOnError },
    });

    return {
        data: q.data?.items ?? [],
        totalCount: q.data?.totalCount ?? 0,
        isLoading: q.isLoading || userLoading,
        isFetching: q.isFetching,
        error: q.error?.message ?? null,
        refetch: q.refetch,
    };
}

// ============================================================================
// useApiMutation — escrituras
// ============================================================================

export interface UseApiMutationOptions<TResult, TVars> {
    invalidateKeys?: QueryKey[];
    successMessage?: string;
    onSuccess?: (data: TResult, vars: TVars) => void;
    onError?: (error: Error) => void;
}

type PathResolver<TVars> = string | ((vars: TVars) => string);

/**
 * Mutación tipada. El path puede ser fijo o una función de las vars
 * (útil para DELETE /persons/:id).
 *
 * @example
 *   const createPerson = useApiMutation<{ id: number }, CreatePersonReq>(
 *       'POST', '/persons',
 *       { invalidateKeys: [queryKeys.persons.all()], successMessage: 'Persona creada' }
 *   );
 *   createPerson.mutate({ person_user: '...', ... });
 *
 * @example
 *   const removePerson = useApiMutation<void, { id: number }>(
 *       'DELETE', (vars) => `/persons/${vars.id}`,
 *   );
 */
export function useApiMutation<TResult = unknown, TVars = void>(
    method: HttpMethod,
    path: PathResolver<TVars>,
    options?: UseApiMutationOptions<TResult, TVars>,
): ReturnType<typeof useMutation<TResult, Error, TVars>> {
    const queryClient = useQueryClient();
    const mutationOpts: UseMutationOptions<TResult, Error, TVars> = {
        mutationFn: async (vars: TVars) => {
            const resolved = typeof path === "function" ? path(vars) : path;
            const body = method === "GET" || method === "DELETE" ? undefined : vars;
            return http<TResult>(method, resolved, { body });
        },
        onSuccess: (data, vars) => {
            if (options?.successMessage) toast.success(options.successMessage);
            if (options?.invalidateKeys) {
                for (const key of options.invalidateKeys) {
                    queryClient.invalidateQueries({ queryKey: key });
                }
            }
            options?.onSuccess?.(data, vars);
        },
        onError: (err) => {
            toast.error(err.message || "Error en la operación");
            options?.onError?.(err);
        },
    };
    return useMutation(mutationOpts);
}

// ============================================================================
// useLookupQuery — datos de referencia (staleTime: Infinity)
// ============================================================================

/**
 * Lookup contra /lookups/:name. staleTime infinito por defecto.
 *
 * @example
 *   const { data } = useLookupQuery<Aircraft[]>('aircrafts', queryKeys.lookups.aircrafts);
 */
export function useLookupQuery<T>(name: string, queryKey: QueryKey) {
    return useApiQuery<T>("GET", `/lookups/${name}`, { staleTime: Infinity }, queryKey);
}
