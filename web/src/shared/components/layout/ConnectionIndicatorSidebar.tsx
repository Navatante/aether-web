// shared/components/layout/ConnectionIndicatorSidebar.tsx
//
// Indicador de conexión a la base de datos para el sidebar.
// Usa el contexto de DatabaseProvider en lugar de duplicar la lógica de monitoreo.

import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDatabase } from "@/providers";

export const ConnectionIndicatorSidebar = () => {
    const { connectionStatus, error, reconnect } = useDatabase();
    const [isReconnecting, setIsReconnecting] = useState(false);

    const handleReconnect = async () => {
        if (isReconnecting) return;
        setIsReconnecting(true);
        try {
            await reconnect();
        } finally {
            setIsReconnecting(false);
        }
    };

    const getStatusIcon = () => {
        if (isReconnecting) {
            return <Loader2 className="h-4 w-4 animate-spin" />;
        }
        switch (connectionStatus) {
            case 'connecting':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'connected':
                return <CheckCircle className="h-4 w-4" />;
            case 'disconnected':
                return <WifiOff className="h-4 w-4" />;
            case 'error':
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    const getStatusColor = () => {
        if (isReconnecting) return 'text-blue-500';
        switch (connectionStatus) {
            case 'connecting':
                return 'text-blue-500';
            case 'connected':
                return 'text-green-500';
            case 'disconnected':
                return 'text-yellow-500';
            case 'error':
                return 'text-red-500';
        }
    };

    const getStatusText = () => {
        if (isReconnecting) return 'Reconectando...';
        switch (connectionStatus) {
            case 'connecting':
                return 'Conectando...';
            case 'connected':
                return 'Conectado';
            case 'disconnected':
                return 'Desconectado';
            case 'error':
                return 'Error';
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${getStatusColor()}`}>
                    {getStatusIcon()}
                    <span className="group-data-[collapsible=icon]:hidden">
                        {getStatusText()}
                    </span>
                    {(connectionStatus === 'error' || connectionStatus === 'disconnected') && !isReconnecting && (
                        <button
                            onClick={handleReconnect}
                            className="ml-auto p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 group-data-[collapsible=icon]:hidden"
                        >
                            <RefreshCw className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" variant="info">
                <p>{error || getStatusText()}</p>
            </TooltipContent>
        </Tooltip>
    );
};
