// providers/DatabaseProvider.tsx
//
// Indica el estado de la conexión backend → base de datos haciendo polling
// de GET /api/v1/health. No abre ni mantiene conexiones él mismo; el binario
// Go gestiona el pool pgx.
//
// Estados:
//   - 'connecting'   → primer fetch en curso
//   - 'connected'    → health respondió {status:"ok"}
//   - 'disconnected' → health respondió {status:"db_down"} o 5xx
//   - 'error'        → fallo de red / respuesta no parseable

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
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
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [error, setError] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const inFlightRef = useRef(false);

    const poll = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const r = await http<HealthResponse>('GET', '/health');
            if (r.status === 'ok') {
                setConnectionStatus('connected');
                setError(null);
            } else {
                setConnectionStatus('disconnected');
                setError(`Backend reportó status: ${r.status}`);
            }
        } catch (err) {
            const isServerErr = err instanceof HttpError && err.status >= 500;
            setConnectionStatus(isServerErr ? 'disconnected' : 'error');
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            if (DATABASE_CONFIG.monitoring.enableDebugLogs) {
                logger.debug(`health poll fail: ${msg}`, 'DatabaseProvider');
            }
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    const reconnect = useCallback(async () => {
        setReconnectAttempts((n) => n + 1);
        await poll();
    }, [poll]);

    useEffect(() => {
        poll();
        const interval = setInterval(poll, DATABASE_CONFIG.monitoring.checkInterval);
        const onFocus = () => poll();
        const onOnline = () => poll();
        const onOffline = () => {
            setConnectionStatus('disconnected');
            setError('Sin conexión a internet');
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [poll]);

    const isConnected = connectionStatus === 'connected';

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
