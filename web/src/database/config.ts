//database/config.ts
/**
 * Configuración del frontend para el monitoreo de la base de datos.
 * El binario Go gestiona el pool pgx; aquí solo se hace polling del estado.
 */
export const DATABASE_CONFIG = {
    monitoring: {
        // Intervalo para verificar el estado de la conexión
        checkInterval: 5000,

        // Logs para desarrollo
        enableDebugLogs: import.meta.env.DEV ?? true
    }
};
