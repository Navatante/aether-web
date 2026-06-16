import { useForm, useFieldArray, Controller, useWatch, SubmitHandler } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import PilotCard from './cards/PilotCard';
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod";
import {
    formSchema,
    type FormData,
} from './schema';
import Select from "react-select"
import DvCard from "./cards/DvCard";
import PapeletaCard from "./cards/PapeletaCard";
import CupoCard from "./cards/CupoCard";
import CapbaCard from "./cards/CapbaCard";
import PasajeroCard from "./cards/PasajeroCard";
import ValidationErrors from "./ValidationErrors";
import { useNavigate } from "react-router-dom";
import { useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";
import { DatePicker } from "@/shared/components/common/DatePicker";
import { ActionButton } from "@/shared/components/common";
import { useAircrafts, useDepartureArrivalPlaces, useEventsLookup } from "@/shared/hooks";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SectionHeader, NumericInput } from '../common';
import { getReactSelectClassNames, transformFormDataForSubmit } from '../../utils';
import { useFlightValidation } from '../../hooks';
import { ManageFlightDataDialog } from '../dialogs';
import { Button } from "@/components/ui/button";
import { logger } from '@/lib/logger';

// Defaults
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

/** Filters to digits only and auto-inserts colon: "1030" → "10:30" */
function formatTimeInput(raw: string): string {
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

interface RegisterFlightFormProps {
    onClose: () => void;
}

export default function RegisterFlightForm({ onClose }: RegisterFlightFormProps) {
    const navigate = useNavigate();
    const [managePlacesOpen, setManagePlacesOpen] = useState(false);

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

    // Validation (extracted to hook)
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

    interface FlightInsertResult {
        flight_id: number;
        success: boolean;
        message: string;
    }

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

    // SKs para papeletas
    const allSks = [
        ...pilots.map(p => p.name).filter((n): n is number => n !== undefined),
        ...dvs.map(d => d.name).filter((n): n is number => n !== undefined),
    ];

    return (
        <ScrollArea className="h-[calc(100vh-120px)] rounded-md border">
            <div className="w-full p-6 space-y-12 bg-background">

                {/* General */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-semibold">General</h1>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setManagePlacesOpen(true)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Gestionar lugares de salida/llegada, aeronaves y eventos"
                        >
                            <Settings2 size={16} />
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {/* Date */}
                        <div className="flex-1">
                            <Controller
                                name="general.date"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={!!fieldState.error}
                                        placeholder="Seleccionar fecha"
                                    />
                                )}
                            />
                        </div>

                        {/* Departure Place */}
                        <div className="flex-1">
                            <Controller
                                name="general.departurePlace"
                                control={control}
                                render={({ field: { onChange, value, ...field } }) => {
                                    const selectedOption = placeOptions.find(option => option.value === value) || null;

                                    return (
                                        <Select
                                            {...field}
                                            value={selectedOption}
                                            onChange={(selectedOption) => {
                                                onChange(selectedOption?.value);
                                            }}
                                            options={placeOptions}
                                            placeholder="Salida"
                                            isSearchable={true}
                                            isLoading={placesLoading}
                                            isDisabled={Boolean(placesLoading || placesError)}
                                            classNames={getReactSelectClassNames(errors, 'general.departurePlace', !!selectedOption)}
                                            classNamePrefix="react-select"
                                        />
                                    );
                                }}
                            />
                        </div>

                        {/* Departure Time */}
                        <div className="w-20">
                            <Controller
                                name="general.departureTime"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Input
                                        value={field.value}
                                        onChange={(e) => field.onChange(formatTimeInput(e.target.value))}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        ref={field.ref}
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        className={cn(
                                            "text-center transition-colors duration-200",
                                            fieldState.error && "border-destructive focus:border-destructive",
                                            field.value && !fieldState.error && "input-filled"
                                        )}
                                    />
                                )}
                            />
                        </div>

                        {/* Arrival Place */}
                        <div className="flex-1">
                            <Controller
                                name="general.arrivalPlace"
                                control={control}
                                render={({ field: { onChange, value, ...field } }) => {
                                    const selectedOption = placeOptions.find(option => option.value === value) || null;

                                    return (
                                        <Select
                                            {...field}
                                            value={selectedOption}
                                            onChange={(selectedOption) => {
                                                onChange(selectedOption?.value);
                                            }}
                                            options={placeOptions}
                                            placeholder="Llegada"
                                            isSearchable={true}
                                            isLoading={placesLoading}
                                            isDisabled={Boolean(placesLoading || placesError)}
                                            classNames={getReactSelectClassNames(errors, 'general.arrivalPlace', !!selectedOption)}
                                            classNamePrefix="react-select"
                                        />
                                    );
                                }}
                            />
                        </div>

                        {/* Arrival Time (derivado de salida + horas totales, solo lectura) */}
                        <div className="w-20">
                            <Controller
                                name="general.arrivalTime"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        value={field.value}
                                        name={field.name}
                                        ref={field.ref}
                                        type="text"
                                        readOnly
                                        tabIndex={-1}
                                        placeholder="HH:MM"
                                        title="Se calcula automáticamente con la hora de salida y las horas totales"
                                        className={cn(
                                            "text-center transition-colors duration-200 cursor-not-allowed",
                                            field.value && "input-filled"
                                        )}
                                    />
                                )}
                            />
                        </div>

                        {/* Aircraft */}
                        <div className="flex-1">
                            <Controller
                                name="general.aircraft"
                                control={control}
                                render={({ field: { onChange, value, ...field } }) => {
                                    const selectedOption = aircraftOptions.find(option => option.value === value) || null;

                                    return (
                                        <Select
                                            {...field}
                                            value={selectedOption}
                                            onChange={(selectedOption) => {
                                                onChange(selectedOption?.value);
                                            }}
                                            options={aircraftOptions}
                                            placeholder="Aeronave"
                                            isLoading={aircraftLoading}
                                            isDisabled={Boolean(aircraftLoading || aircraftError)}
                                            classNames={getReactSelectClassNames(errors, 'general.aircraft', !!selectedOption)}
                                            classNamePrefix="react-select"
                                        />
                                    );
                                }}
                            />
                    </div>

                        {/* Event */}
                        <div className="flex-1">
                            <Controller
                                name="general.event"
                                control={control}
                                render={({ field: { onChange, value, ...field } }) => {
                                    const selectedOption = eventOptions.find(option => option.value === value) || null;

                                    return (
                                        <Select
                                            {...field}
                                            value={selectedOption}
                                            onChange={(selectedOption) => {
                                                onChange(selectedOption?.value);
                                            }}
                                            options={eventOptions}
                                            placeholder="Evento"
                                            isLoading={eventLoading}
                                            isDisabled={Boolean(eventLoading || eventError)}
                                            classNames={getReactSelectClassNames(errors, 'general.event', !!selectedOption)}
                                            classNamePrefix="react-select"
                                        />
                                    );
                                }}
                            />
                        </div>

                        {/* Horas totales */}
                        <div className="w-28">
                            <NumericInput control={control} name="general.totalHours" placeholder="Horas totales" errors={errors} mode="hour" />
                        </div>
                    </div>
                </div>

                {/* Pilotos */}
                <div className="space-y-4">
                    <SectionHeader title="Pilotos" onAdd={addPilot} />
                    <ScrollArea className="h-[290px] w-full rounded-md border bg-background">
                        <div className="p-4 space-y-4">
                            {pilotsFields.map((field, index) => (
                                <PilotCard
                                    key={field.id}
                                    index={index}
                                    control={control}
                                    errors={errors}
                                    onRemove={removePilot}
                                    canRemove={pilotsFields.length > 1 && index !== 0}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Dotaciones */}
                <div className="space-y-4">
                    <SectionHeader title="Dotaciones" onAdd={addDv} />
                    <ScrollArea className="h-[201px] w-full rounded-md border bg-background">
                        <div className="p-4 space-y-4">
                            {dvsFields.map((field, index) => (
                                <DvCard
                                    key={field.id}
                                    index={index}
                                    control={control}
                                    errors={errors}
                                    onRemove={removeDv}
                                    canRemove={true}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <div className="grid grid-cols-2 items-center gap-6">
                    {/* Papeletas */}
                    <div className="space-y-4">
                        <SectionHeader title="Papeletas" onAdd={addPapeletas} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {papeletasFields.map((field, index) => (
                                    <PapeletaCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removePapeleta}
                                        canRemove={true}
                                        selectedSks={allSks}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Cupos */}
                    <div className="space-y-4">
                        <SectionHeader title="Cupos" onAdd={addCupos} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {cuposFields.map((field, index) => (
                                    <CupoCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removeCupos}
                                        canRemove={cuposFields.length > 1 && index !== 0}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Capba (capacidades básicas) */}
                    <div className="space-y-4">
                        <SectionHeader title="CAPBAS" onAdd={addCapba} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {capbasFields.map((field, index) => (
                                    <CapbaCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removeCapba}
                                        canRemove={true}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Pasajeros */}
                    <div className="space-y-4">
                        <SectionHeader title="Pasajeros" onAdd={addPasajeros} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {pasajerosFields.map((field, index) => (
                                    <PasajeroCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removePasajeros}
                                        canRemove={true}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Mensajes de validación */}
                <div>
                    <ValidationErrors
                        errors={errors}
                        hoursValidationErrors={hoursValidationErrors}
                        duplicateErrors={duplicateErrors}
                    />
                </div>

                {/* Botones del formulario */}
                <div className="flex justify-center gap-3">
                    <ActionButton
                        variant="add"
                        icon={Save}
                        label={isSubmitting ? "Registrando..." : "Registrar vuelo"}
                        onClick={handleSubmit(onSubmit, onError)}
                        disabled={isSubmitting}
                        className="cursor-pointer"
                    />
                </div>
            </div>

            <ManageFlightDataDialog
                open={managePlacesOpen}
                onOpenChange={setManagePlacesOpen}
            />
        </ScrollArea>
    );
}
