// src/lib/logger.ts — Aether-Web (post-Tauri)
//
// Envía logs del frontend al backend Go por HTTP POST /logs.
// Mantiene la API pública del logger Tauri original: logger.{level} + useLogger.

import { http, HttpError } from "./http";

type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

interface LogPayload {
    level: LogLevel;
    message: string;
    context?: string;
}

async function sendLog(level: LogLevel, message: string, context?: string): Promise<void> {
    const payload: LogPayload = { level, message, context };
    try {
        // Endpoint pendiente en backend (sub-lote posterior). Si falla con 404
        // caemos al console sin ruido.
        await http<void>("POST", "/logs", { body: payload });
    } catch (error) {
        const prefix = context ? `[${context}]` : "";
        if (error instanceof HttpError && error.status === 404) {
            consoleLog(level, `${prefix} ${message}`);
            return;
        }
        console.error(`[Logger Error] no se pudo enviar log: ${prefix} ${message}`, error);
    }
}

function consoleLog(level: LogLevel, msg: string) {
    switch (level) {
        case "error":
            console.error(msg);
            break;
        case "warn":
            console.warn(msg);
            break;
        case "info":
            console.info(msg);
            break;
        case "debug":
            console.debug(msg);
            break;
        case "trace":
            console.trace(msg);
            break;
    }
}

export const logger = {
    error: (message: string, context?: string) => sendLog("error", message, context),
    warn: (message: string, context?: string) => sendLog("warn", message, context),
    info: (message: string, context?: string) => sendLog("info", message, context),
    debug: (message: string, context?: string) => sendLog("debug", message, context),
    trace: (message: string, context?: string) => sendLog("trace", message, context),
};

/**
 * Hook para componentes con contexto fijo.
 * @example
 *   const log = useLogger('FlightsPage');
 *   log.info('mounted');
 */
export function useLogger(context: string) {
    return {
        error: (message: string) => logger.error(message, context),
        warn: (message: string) => logger.warn(message, context),
        info: (message: string) => logger.info(message, context),
        debug: (message: string) => logger.debug(message, context),
        trace: (message: string) => logger.trace(message, context),
    };
}
