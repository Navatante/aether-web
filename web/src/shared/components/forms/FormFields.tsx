// Campos de formulario reutilizables (Label + control + mensaje de error).
// Colapsan el andamiaje repetido de los formularios de diálogo (persona,
// comisión…): input de texto, react-select de catálogo y fecha con popover.

import * as React from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import Select from "react-select";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { cn } from "@/lib/utils";

export function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-sm text-destructive">{message}</p>;
}

// ===== Texto =====

interface TextFieldProps extends React.ComponentProps<typeof Input> {
    id: string;
    label: string;
    error?: string;
}

export function TextField({ id, label, error, className, ...inputProps }: TextFieldProps) {
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} className={cn(error && "border-destructive", className)} {...inputProps} />
            <FieldError message={error} />
        </div>
    );
}

// ===== Select de catálogo (react-select con las mismas opciones que valores) =====

interface SelectFieldProps<T extends FieldValues> {
    label: string;
    name: Path<T>;
    control: Control<T>;
    options: readonly string[];
    error?: string;
    inputId?: string;
}

export function SelectField<T extends FieldValues>({ label, name, control, options, error, inputId }: SelectFieldProps<T>) {
    const id = inputId ?? `select-${String(name)}`;
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Controller
                name={name}
                control={control}
                render={({ field: { onChange, value, ...field } }) => {
                    const opts = options.map((o) => ({ value: o, label: o }));
                    const selected = opts.find((o) => o.value === value) || null;
                    return (
                        <Select
                            {...field}
                            inputId={id}
                            value={selected}
                            onChange={(opt) => onChange(opt?.value ?? '')}
                            options={opts}
                            placeholder="Seleccionar"
                            isSearchable={true}
                            classNames={getSelectClassNames(!!error, !!selected)}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            styles={menuPortalStyles}
                        />
                    );
                }}
            />
            <FieldError message={error} />
        </div>
    );
}

// ===== Fecha (popover + calendario, rango 1900..hoy) =====

interface DateFieldProps {
    label: string;
    value?: Date;
    onSelect: (date?: Date) => void;
    error?: string;
    /** Marca el botón con borde destructivo además del mensaje. */
    errorBorder?: boolean;
}

export function DateField({ label, value, onSelect, error, errorBorder }: DateFieldProps) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <Popover>
                <PopoverTrigger render={
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !value && "text-muted-foreground",
                            errorBorder && error && "border-destructive"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {value ? format(value, "dd/MM/yyyy") : <span>Seleccionar</span>}
                    </Button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={(date) => onSelect(date || undefined)}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        captionLayout="dropdown"
                        startMonth={new Date(1900, 0)}
                        endMonth={new Date()}
                    />
                </PopoverContent>
            </Popover>
            <FieldError message={error} />
        </div>
    );
}
