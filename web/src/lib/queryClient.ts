import { QueryClient, keepPreviousData } from '@tanstack/react-query';
import { HttpError } from './http';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // 5 min: ventana de frescura vs. coste de red para una intranet cuyos
            // datos cambian con poca frecuencia. También acota el refetch-on-focus
            // de abajo (solo refetchea lo que ya esté obsoleto, >5 min).
            staleTime: 5 * 60 * 1000,
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
            // App en navegador y multiusuario: al volver a la pestaña refresca por
            // si otro usuario tocó los datos. El staleTime (5 min) lo limita a datos
            // ya obsoletos, así que el coste es casi nulo y no interrumpe formularios
            // (su estado es local; esto solo refetchea datos de servidor en segundo plano).
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 0,
        },
    },
});
