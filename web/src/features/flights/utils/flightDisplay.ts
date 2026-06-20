// Helpers de presentación para la lista de vuelos (formato de fecha y mapeo de
// evento → tipo de badge). Funciones puras, sin estado.

import type { EventType } from "@/shared/components/common";

/** Formatea una fecha UTC (y hora opcional) a hora local de España. */
export const formatDateTimeSpain = (dateString: string, timeString?: string): string => {
    let utcDate: Date;

    if (timeString) {
        // Fecha y hora separadas.
        utcDate = new Date(`${dateString}T${timeString}Z`);
    } else {
        // Solo fecha (puede o no incluir la T/Z).
        const dateStr = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
        utcDate = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
    }

    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    };

    return utcDate.toLocaleString('es-ES', options);
};

/** Mapea el nombre de evento ("Misión - …") al tipo de EventBadge. */
export const getEventType = (evento: string): EventType => {
    const type = evento.split(' - ')[0];

    switch (type) {
        case 'Misión':
            return 'mision';
        case 'Maniobra nacional':
            return 'maniobra-nacional';
        case 'Maniobra internacional':
            return 'maniobra-internacional';
        case 'Pruebas':
            return 'pruebas';
        case 'Adaptación':
            return 'adaptacion';
        case 'Adiestramiento':
            return 'adiestramiento';
        default:
            return 'default';
    }
};
