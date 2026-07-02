// Sección "General" del formulario de registro de vuelo: fecha, lugares/horas
// de salida y llegada, aeronave, evento y horas totales. Solo render; recibe
// el control de react-hook-form y las options/estados de los lookups del hook.

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import Select from "react-select";
import { Settings2 } from 'lucide-react';

import type { FormData } from './schema';
import { DatePicker } from "@/shared/components/common/DatePicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NumericInput } from '../common';
import { getReactSelectClassNames } from '../../utils';
import { formatTimeInput } from '../../hooks/useFlightForm';

interface SelectOption {
    value: number;
    label: string;
}

interface GeneralSectionProps {
    control: Control<FormData>;
    errors: FieldErrors<FormData>;
    aircraftOptions: SelectOption[];
    aircraftLoading: boolean;
    aircraftError: unknown;
    placeOptions: SelectOption[];
    placesLoading: boolean;
    placesError: unknown;
    eventOptions: SelectOption[];
    eventLoading: boolean;
    eventError: unknown;
    onOpenManage: () => void;
}

export default function GeneralSection({
    control,
    errors,
    aircraftOptions,
    aircraftLoading,
    aircraftError,
    placeOptions,
    placesLoading,
    placesError,
    eventOptions,
    eventLoading,
    eventError,
    onOpenManage,
}: GeneralSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">General</h1>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onOpenManage}
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
    );
}
