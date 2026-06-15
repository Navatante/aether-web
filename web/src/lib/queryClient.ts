import { QueryClient, keepPreviousData } from '@tanstack/react-query';
import { HttpError } from './http';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 min - desktop app, data changes infrequently
            gcTime: 30 * 60 * 1000,         // 30 min garbage collection
            // Al cambiar la queryKey (paginación, rango de fechas, filtros, mes del
            // calendario…) mantiene visibles los datos anteriores mientras llega la
            // nueva respuesta, en vez de parpadear a "cargando"/vacío. En queries de
            // clave estable (lookups, ratings) es un no-op. Durante el placeholder,
            // isFetching=true (los botones de refrescar ya lo reflejan).
            placeholderData: keepPreviousData,
            // 4xx no van a cambiar al reintentar (403/404/422…): no se reintentan.
            // 5xx y errores de red sí, una vez.
            retry: (failureCount, error) => {
                if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,     // Desktop app, not needed
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 0,
        },
    },
});
