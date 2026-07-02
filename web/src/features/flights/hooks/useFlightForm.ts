// Estado y lógica del formulario de registro de vuelo: defaults, react-hook-form,
// field arrays, validación cruzada, lookups, efectos derivados (lugar por
// defecto, hora de llegada) y el submit transaccional. RegisterFlightForm queda
// como composición solo-render de las secciones.

import { useForm, useFieldArray, useWatch, SubmitHandler } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

import { formSchema, type FormData } from '../components/forms/schema';
import { useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";
import { useAircrafts, useDepartureArrivalPlaces, useEventsLookup } from "@/shared/hooks";
import { transformFormDataForSubmit } from '../utils';
import { useFlightValidation } from './useFlightValidation';
import { logger } from '@/lib/logger';

// ===== Defaults =====

const createDefaultPilot = () => ({
    name: undefined as number | undefined,
    person_hour: {
        hDay: '',
        hNight: '',
        hGvn: '',
    },
    ift_hour: '',
    gvnType_hour: {
        hIit: '',
        hAnvis: '',
    },
    instructor_hour: '',
    formation_hour: {
        hfDay: '',
        hfGvn: '',
    },
    app: {
        precision: '',
        noPrecision: '',
        td: '',
        sp: '',
    },
    landing: {
        tierra: { lDay: '', lNight: '', lGvn: '' },
        mono: { lDay: '', lNight: '', lGvn: '' },
        multi: { lDay: '', lNight: '', lGvn: '' },
        carrier: { lDay: '', lNight: '', lGvn: '' }
    }
});

const createDefaultDv = () => ({
    name: undefined as number | undefined,
    person_hour: {
        hDay: '',
        hNight: '',
        hGvn: '',
    },
    wt_hour: '',
    projectile: {
        m3m: '',
        mag58: '',
    }
});

const createDefaultPapeleta = (): { crew: number[]; papeleta: { sk: number; period: 'dia' | 'nc' | 'gvn' }[] } => ({
    crew: [],
    papeleta: [],
});

const createDefaultCupos = () => ({
    autoridad: undefined as number | undefined,
    horas: '',
});

const createDefaultCapba = () => ({
    capba: undefined as number | undefined,
    horas: '',
});

const createDefaultPasajeros = () => ({
    tipo: undefined as number | undefined,
    cantidad: '',
    ruta: '',
});

// ===== Helpers =====

/** Filters to digits only and auto-inserts colon: "1030" → "10:30" */
export function formatTimeInput(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const timeRegexHHMM = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

/** Lugar de salida/llegada por defecto al abrir el formulario (CÁDIZ/Rota). */
const DEFAULT_PLACE_NAME = 'CADIZ/Rota';

/** Normaliza para comparar nombres ignorando acentos y mayúsculas. */
function normalizePlaceName(name: string): string {
    return name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Suma `totalHours` (horas decimales, p. ej. "1.5" = 1 h 30 min) a una hora
 * "HH:MM" y devuelve la hora de llegada "HH:MM" (envuelve a 24 h). Devuelve ''
 * si la salida o las horas no son válidas todavía.
 */
function computeArrivalTime(departureTime: string, totalHours: string): string {
    if (!timeRegexHHMM.test(departureTime)) return '';
    const hours = parseFloat(totalHours);
    if (!Number.isFinite(hours) || hours <= 0) return '';
    const [h, m] = departureTime.split(':').map(Number);
    const total = h * 60 + m + Math.round(hours * 60);
    const wrapped = ((total % 1440) + 1440) % 1440;
    const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
    const mm = String(wrapped % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

interface FlightInsertResult {
    flight_id: number;
    success: boolean;
    message: string;
}

// ===== Hook =====

export function useFlightForm(onClose: () => void) {
    const navigate = useNavigate();

    const { control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            general: {
                date: new Intl.DateTimeFormat('sv-SE', {
                    timeZone: 'Europe/Madrid',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                }).format(new Date()),
                departurePlace: undefined,
                departureTime: '',
                arrivalPlace: undefined,
                arrivalTime: '',
                aircraft: undefined,
                event: undefined,
                totalHours: '',
            },
            pilots: [createDefaultPilot()] as FormData['pilots'],
            dvs: [],
            papeletas: [],
            cupos: [createDefaultCupos()] as FormData['cupos'],
            capbas: [],
            pasajeros: [],
        }
    });

    // Single watches (no duplicates)
    const totalHours = useWatch({ control, name: 'general.totalHours' });
    const departureTime = useWatch({ control, name: 'general.departureTime' });
    const pilots = useWatch({ control, name: 'pilots' });
    const dvs = useWatch({ control, name: 'dvs' });
    const cupos = useWatch({ control, name: 'cupos' });
    const capbas = useWatch({ control, name: 'capbas' });

    // Validación cruzada (horas y duplicados)
    const { hoursValidationErrors, duplicateErrors } = useFlightValidation(totalHours, pilots, dvs, cupos, capbas);

    const { fields: pilotsFields, append: appendPilot, remove: removePilot } = useFieldArray({
        control,
        name: "pilots"
    });

    const { fields: dvsFields, append: appendDv, remove: removeDv } = useFieldArray({
        control,
        name: "dvs"
    });

    const { fields: papeletasFields, append: appendPapeleta, remove: removePapeleta } = useFieldArray({
        control,
        name: "papeletas"
    });

    const { fields: cuposFields, append: appendCupos, remove: removeCupos } = useFieldArray({
        control,
        name: "cupos"
    });

    const { fields: capbasFields, append: appendCapba, remove: removeCapba } = useFieldArray({
        control,
        name: "capbas"
    });

    const { fields: pasajerosFields, append: appendPasajeros, remove: removePasajeros } = useFieldArray({
        control,
        name: "pasajeros"
    });

    // El insert es transaccional y devuelve { success, message } en el body, así
    // que el toast de éxito se decide según result.success (no con successMessage).
    // El toast de error de useApiMutation cubre los fallos HTTP. Invalida el
    // dominio de vuelos de la escuadrilla para refrescar la lista.
    const { id: escId } = useEscuadrilla();
    const createFlight = useApiMutation<FlightInsertResult, Record<string, unknown>>(
        'POST', '/flights', { invalidateKeys: [queryKeys.flights.all(escId ?? 0)] },
    );

    const onSubmit: SubmitHandler<FormData> = async (data) => {
        if (hoursValidationErrors.length > 0) {
            toast.error('Hay errores de validación de horas.');
            return;
        }

        if (duplicateErrors.length > 0) {
            toast.error('No puede haber duplicados.');
            return;
        }

        const flightData = transformFormDataForSubmit(data);

        try {
            const result = await createFlight.mutateAsync(flightData as Record<string, unknown>);

            if (result.success) {
                toast.success(result.message);
                navigate('/flights');
                onClose();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            logger.error(`Error al registrar el vuelo: ${error}`, 'RegisterFlightForm');
        }
    };

    const onError = () => {
        logger.warn('Errores de validación en el formulario', 'RegisterFlightForm');
        toast.error('Hay errores en el formulario. Verifica los campos.');
    };

    // Handlers para agregar (need cast for field array append)
    const addPilot = () => appendPilot(createDefaultPilot() as FormData['pilots'][number]);
    const addDv = () => appendDv(createDefaultDv() as FormData['dvs'][number]);
    const addPapeletas = () => appendPapeleta(createDefaultPapeleta());
    const addCupos = () => appendCupos(createDefaultCupos() as FormData['cupos'][number]);
    const addCapba = () => appendCapba(createDefaultCapba() as FormData['capbas'][number]);
    const addPasajeros = () => appendPasajeros(createDefaultPasajeros() as FormData['pasajeros'][number]);

    // Queries (lookups)
    const { data: aircraftArray, loading: aircraftLoading, error: aircraftError } = useAircrafts();
    const { data: placesArray, loading: placesLoading, error: placesError } = useDepartureArrivalPlaces();
    const { data: eventArray, loading: eventLoading, error: eventError } = useEventsLookup();

    // Preselecciona CADIZ/Rota en salida y llegada una vez cargados los lugares.
    // Solo se aplica una vez (ref), para no pisar la elección posterior del usuario.
    const defaultPlaceApplied = useRef(false);
    useEffect(() => {
        if (defaultPlaceApplied.current || !placesArray) return;
        const defaultPlace = placesArray.find(
            p => normalizePlaceName(p.departure_arrival_place_name) === normalizePlaceName(DEFAULT_PLACE_NAME)
        );
        if (!defaultPlace) return;
        setValue('general.departurePlace', defaultPlace.departure_arrival_place_sk);
        setValue('general.arrivalPlace', defaultPlace.departure_arrival_place_sk);
        defaultPlaceApplied.current = true;
    }, [placesArray, setValue]);

    // La hora de llegada se deriva de la salida + horas totales (campo de solo lectura).
    useEffect(() => {
        setValue('general.arrivalTime', computeArrivalTime(departureTime, totalHours), {
            shouldValidate: true,
        });
    }, [departureTime, totalHours, setValue]);

    // Options de selects
    const aircraftOptions = aircraftArray?.map(a => ({
        value: a.aircraft_sk,
        label: a.aircraft_number
    })) || [];

    const placeOptions = placesArray?.map(p => ({
        value: p.departure_arrival_place_sk,
        label: p.departure_arrival_place_name,
    })) || [];

    const eventOptions = eventArray?.map(event => ({
        value: event.event_sk,
        label: event.event,
    })) || [];

    // SKs de todos los tripulantes seleccionados (para las papeletas)
    const allSks = [
        ...pilots.map(p => p.name).filter((n): n is number => n !== undefined),
        ...dvs.map(d => d.name).filter((n): n is number => n !== undefined),
    ];

    return {
        control,
        errors,
        isSubmitting,
        submit: handleSubmit(onSubmit, onError),
        hoursValidationErrors,
        duplicateErrors,
        // field arrays + add/remove
        pilotsFields, addPilot, removePilot,
        dvsFields, addDv, removeDv,
        papeletasFields, addPapeletas, removePapeleta,
        cuposFields, addCupos, removeCupos,
        capbasFields, addCapba, removeCapba,
        pasajerosFields, addPasajeros, removePasajeros,
        // lookups para la sección General
        aircraftOptions, aircraftLoading, aircraftError,
        placeOptions, placesLoading, placesError,
        eventOptions, eventLoading, eventError,
        allSks,
    };
}
