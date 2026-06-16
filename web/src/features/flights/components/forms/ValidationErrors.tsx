import { FieldErrors } from "react-hook-form";
import { FormData } from "./schema";
import type { HoursValidationError, DuplicateValidationError } from "../../hooks";

const FIELD_NAME_MAP: Record<string, string> = {
    'date': 'Fecha',
    'departurePlace': 'Lugar salida',
    'departureTime': 'Hora salida',
    'arrivalPlace': 'Lugar llegada',
    'arrivalTime': 'Hora llegada',
    'aircraft': 'Aeronave',
    'event': 'Evento',
    'totalHours': 'Horas totales',
    'name': 'Nombre',
    'person_hour': 'Horas de vuelo',
    'hDay': 'Día',
    'hNight': 'Noche',
    'hGvn': 'GVN',
    'ift_hour': 'Horas instrumentos',
    'gvnType_hour': 'Horas tipo GVN',
    'hIit': 'Horas IIT',
    'hAnvis': 'Horas ANVIS',
    'instructor_hour': 'Horas instructor',
    'formation_hour': 'Horas formación',
    'hfDay': 'Horas formación día',
    'hfGvn': 'Horas formación GVN',
    'app': 'Aproximaciones',
    'precision': 'Precisión',
    'noPrecision': 'No precisión',
    'td': 'TD',
    'sp': 'SP',
    'landing': 'Tomas',
    'tierra': 'Tierra',
    'mono': 'Monospot',
    'multi': 'Multispot',
    'carrier': 'Carrier',
    'lDay': 'Día',
    'lNight': 'Noche',
    'lGvn': 'GVN',
    'wt_hour': 'Horas WT',
    'projectile': 'Proyectil',
    'm3m': 'M3M',
    'mag58': 'MAG58',
    'crew': 'Tripulación',
    'papeleta': 'Papeleta',
    'autoridad': 'Autoridad',
    'capba': 'Capacidad básica',
    'horas': 'Horas',
    'tipo': 'Tipo',
    'cantidad': 'Cantidad',
    'ruta': 'Ruta'
};

const extractErrorMessages = (errorObj: unknown, path: string = ''): string[] => {
    const messages: string[] = [];

    if (!errorObj || typeof errorObj !== 'object') return messages;

    const obj = errorObj as Record<string, unknown>;

    if ('message' in obj && typeof obj.message === 'string') {
        const pathParts = path.split(' - ');
        const friendlyPathParts = pathParts.map(part => FIELD_NAME_MAP[part] || part);
        const friendlyPath = friendlyPathParts.join(' - ');
        messages.push(`${friendlyPath}: ${obj.message}`);
        return messages;
    }

    Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
            const newPath = path ? `${path} - ${key}` : key;
            messages.push(...extractErrorMessages(value, newPath));
        }
    });

    return messages;
};

interface ValidationErrorsProps {
    errors: FieldErrors<FormData>;
    hoursValidationErrors: HoursValidationError[];
    duplicateErrors: DuplicateValidationError[];
}

function ValidationErrors({ errors, hoursValidationErrors, duplicateErrors }: ValidationErrorsProps) {
    if (Object.keys(errors).length === 0 && hoursValidationErrors.length === 0 && duplicateErrors.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <h4 className="font-semibold text-destructive mb-3">Errores de validación:</h4>
            <div className="space-y-2">
                {duplicateErrors.map((error, idx) => {
                    const entityName = error.type === 'pilots' ? 'Pilotos' :
                        error.type === 'dvs' ? 'Dotaciones' :
                            error.type === 'capbas' ? 'Capacidades básicas' :
                                'Cupos (Autoridades)';
                    return (
                        <div key={`duplicate-${idx}`}>
                            <p className="text-sm text-destructive">
                                - {entityName}: No puede haber duplicados
                            </p>
                        </div>
                    );
                })}

                {hoursValidationErrors.map((error, idx) => (
                    <p key={`hours-${idx}`} className="text-sm text-destructive">
                        - {error.message}
                        <span className="ml-2 text-xs">
                            (Esperado: {error.expected.toFixed(1)}h, Actual: {error.actual.toFixed(1)}h)
                        </span>
                    </p>
                ))}

                {errors.general && extractErrorMessages(errors.general, 'General').map((msg, idx) => (
                    <p key={`general-${idx}`} className="text-sm text-destructive">- {msg}</p>
                ))}

                {errors.pilots && Array.isArray(errors.pilots) && errors.pilots.map((pilotError, index) => {
                    if (!pilotError) return null;
                    return extractErrorMessages(pilotError, `Piloto ${index + 1}`).map((msg, idx) => (
                        <p key={`pilot-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}

                {errors.dvs && Array.isArray(errors.dvs) && errors.dvs.map((dvError, index) => {
                    if (!dvError) return null;
                    return extractErrorMessages(dvError, `Dotación ${index + 1}`).map((msg, idx) => (
                        <p key={`dv-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}

                {errors.papeletas && Array.isArray(errors.papeletas) && errors.papeletas.map((papeletaError, index) => {
                    if (!papeletaError) return null;
                    return extractErrorMessages(papeletaError, `Papeleta ${index + 1}`).map((msg, idx) => (
                        <p key={`papeleta-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}

                {errors.cupos && Array.isArray(errors.cupos) && errors.cupos.map((cupoError, index) => {
                    if (!cupoError) return null;
                    return extractErrorMessages(cupoError, `Cupo ${index + 1}`).map((msg, idx) => (
                        <p key={`cupo-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}

                {errors.capbas && Array.isArray(errors.capbas) && errors.capbas.map((capbaError, index) => {
                    if (!capbaError) return null;
                    return extractErrorMessages(capbaError, `Capba ${index + 1}`).map((msg, idx) => (
                        <p key={`capba-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}

                {errors.pasajeros && Array.isArray(errors.pasajeros) && errors.pasajeros.map((pasajeroError, index) => {
                    if (!pasajeroError) return null;
                    return extractErrorMessages(pasajeroError, `Pasajero ${index + 1}`).map((msg, idx) => (
                        <p key={`pasajero-${index}-${idx}`} className="text-sm text-destructive">- {msg}</p>
                    ));
                })}
            </div>
        </div>
    );
}

export default ValidationErrors;
