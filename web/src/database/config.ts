//database/config.ts
/**
 * Configuración del frontend para el monitoreo de la base de datos
 * La configuración de conexión ahora se maneja completamente en Rust (lib.rs)
 */
export const DATABASE_CONFIG = {
    monitoring: {
        // Intervalo para verificar el estado de la conexión
        checkInterval: 5000,

        // Configuración de reconexión automática
        reconnectDelay: 3000,
        reconnectDelayMultiplier: 1.5,
        maxReconnectDelay: 30000,
        maxReconnectAttempts: 20,

        // Logs para desarrollo
        enableDebugLogs: import.meta.env.DEV ?? true
    }
};
