// providers/DatabaseProvider.tsx
//
// Indica el estado de la conexión backend → base de datos haciendo polling
// de GET /api/v1/health. No abre ni mantiene conexiones él mismo; el binario
// Go gestiona el pool pgx.
//
// El polling, el refetch al enfocar/reconectar y el dedupe de peticiones en
// vuelo los gestiona TanStack Query (refetchInterval + onlineManager); aquí solo
// derivamos el estado de conexión del estado de la query.
//
// Estados:
//   - 'connecting'   → primer fetch en curso
//   - 'connected'    → health respondió {status:"ok"}
//   - 'disconnected' → health respondió {status:"db_down"}, 5xx, u offline
//   - 'error'        → fallo de red / respuesta no parseable

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { http, HttpError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { DATABASE_CONFIG } from '@/database/config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface DatabaseContextType {
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    error: string | null;
    reconnectAttempts: number;
    isReady: boolean;
    reconnect: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType>({
    isConnected: false,
    connectionStatus: 'connecting',
    error: null,
    reconnectAttempts: 0,
    isReady: false,
    reconnect: async () => {},
});

interface DatabaseProviderProps {
    children: React.ReactNode;
}

interface HealthResponse {
    status: string;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const query = useQuery<HealthResponse>({
        queryKey: ['health'],
        queryFn: ({ signal }) => http<HealthResponse>('GET', '/health', { signal }),
        refetchInterval: DATABASE_CONFIG.monitoring.checkInterval,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,   // override del default global: el health SÍ refresca al enfocar
        refetchOnReconnect: true,
        retry: false,                 // un poll fallido no se reintenta; el siguiente tick (5s) lo hace
        staleTime: 0,
    });

    // Log de depuración en fallo (preserva el comportamiento previo).
    useEffect(() => {
        if (query.error && DATABASE_CONFIG.monitoring.enableDebugLogs) {
            const msg = query.error instanceof Error ? query.error.message : String(query.error);
            logger.debug(`health poll fail: ${msg}`, 'DatabaseProvider');
        }
    }, [query.error]);

    // Estado de conexión derivado del estado de la query.
    let connectionStatus: ConnectionStatus;
    let error: string | null = null;
    if (query.fetchStatus === 'paused') {
        // onlineManager detectó que el navegador está offline.
        connectionStatus = 'disconnected';
        error = 'Sin conexión a internet';
    } else if (query.isPending) {
        connectionStatus = 'connecting';
    } else if (query.error) {
        const isServerErr = query.error instanceof HttpError && query.error.status >= 500;
        connectionStatus = isServerErr ? 'disconnected' : 'error';
        error = query.error.message;
    } else if (query.data?.status === 'ok') {
        connectionStatus = 'connected';
    } else {
        connectionStatus = 'disconnected';
        error = `Backend reportó status: ${query.data?.status}`;
    }

    const isConnected = connectionStatus === 'connected';

    const reconnect = async () => {
        setReconnectAttempts((n) => n + 1);
        await query.refetch();
    };

    return (
        <DatabaseContext.Provider
            value={{
                isConnected,
                connectionStatus,
                error,
                reconnectAttempts,
                isReady: isConnected,
                reconnect,
            }}
        >
            {children}
        </DatabaseContext.Provider>
    );
}

export const useDatabase = () => useContext(DatabaseContext);
