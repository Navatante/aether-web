import { useForm, useFieldArray, Controller, useWatch, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
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
import PasajeroCard from "./cards/PasajeroCard";
import ValidationErrors from "./ValidationErrors";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/http";
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

const createDefaultPapeleta = (): { crew: number[]; papeleta: { sk: number; period: 'dia' | 'gvn' }[] } => ({
    crew: [],
    papeleta: [],
});

const createDefaultCupos = () => ({
    autoridad: undefined as number | undefined,
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

interface RegisterFlightFormProps {
    onClose: () => void;
}

export default function RegisterFlightForm({ onClose }: RegisterFlightFormProps) {
    const navigate = useNavigate();
    const [managePlacesOpen, setManagePlacesOpen] = useState(false);

    const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
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
            pasajeros: [],
        }
    });

    // Single watches (no duplicates)
    const totalHours = useWatch({ control, name: 'general.totalHours' });
    const pilots = useWatch({ control, name: 'pilots' });
    const dvs = useWatch({ control, name: 'dvs' });
    const cupos = useWatch({ control, name: 'cupos' });

    // Validation (extracted to hook)
    const { hoursValidationErrors, duplicateErrors } = useFlightValidation(totalHours, pilots, dvs, cupos);

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

    const { fields: pasajerosFields, append: appendPasajeros, remove: removePasajeros } = useFieldArray({
        control,
        name: "pasajeros"
    });

    interface FlightInsertResult {
        flight_id: number;
        success: boolean;
        message: string;
    }

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
            const result = await http<FlightInsertResult>('POST', '/flights', { body: flightData });

            if (result.success) {
                toast.success(result.message);
                navigate('/flights');
                onClose();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            logger.error(`Error al registrar el vuelo: ${error}`, 'RegisterFlightForm');
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Error: ${errorMessage}`);
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
    const addPasajeros = () => appendPasajeros(createDefaultPasajeros() as FormData['pasajeros'][number]);

    // Queries (lookups)
    const { data: aircraftArray, loading: aircraftLoading, error: aircraftError, refetch: refetchAircrafts } = useAircrafts();
    const { data: placesArray, loading: placesLoading, error: placesError, refetch: refetchPlaces } = useDepartureArrivalPlaces();
    const { data: eventArray, loading: eventLoading, error: eventError, refetch: refetchEvents } = useEventsLookup();

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

                        {/* Arrival Time */}
                        <div className="w-20">
                            <Controller
                                name="general.arrivalTime"
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

                <div className="grid grid-cols-3 items-center gap-6">
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
                onRefresh={{
                    places: refetchPlaces,
                    aircrafts: refetchAircrafts,
                    events: refetchEvents,
                }}
            />
        </ScrollArea>
    );
}
