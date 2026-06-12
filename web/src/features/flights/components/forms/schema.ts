import * as z from "zod"
import {Control, FieldErrors} from "react-hook-form";

const hourRegex = /^\d+(\.\d)?$/;

// Esquema para horas OPCIONALES
const optionalHourSchema = z.literal('').or(
    z.string()
        .regex(hourRegex, "Formato inválido")
        .refine((val) => {
            if (val === '.') return false;
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
        }, { message: "Debe ser un número mayor a 0" })
        .refine((val) => {
            const num = parseFloat(val);
            return num <= 9999.99;
        }, { message: "El valor es demasiado grande" })
);

// Esquema para horas OBLIGATORIAS
const requiredHourSchema = z.string()
    .min(1, "Requerido")
    .regex(hourRegex, "Formato inválido")
    .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
    }, { message: "Debe ser un número mayor a 0" })
    .refine((val) => {
        const num = parseFloat(val);
        return num <= 9999.99;
    }, { message: "El valor es demasiado grande" });

// Esquema para números OPCIONALES
const optionalNumberSchema = z.literal('').or(
    z.string()
        .regex(/^\d+$/, "Debe contener solo números enteros positivos")
        .refine((val) => {
            const num = parseInt(val);
            return !isNaN(num) && num >= 0;
        }, { message: "Debe ser un número entero positivo" })
);

// Esquema para números OBLIGATORIOS
const requiredNumberSchema = z.string()
    .min(1, "Requerido")
    .regex(/^\d+$/, "Debe contener solo números enteros positivos")
    .refine((val) => {
        const num = parseInt(val);
        return !isNaN(num) && num >= 0;
    }, { message: "Debe ser un número entero positivo" });

// Esquema para person_hour (usado por pilots y dvs)
const personHourSchema = z.object({
    hDay: optionalHourSchema,
    hNight: optionalHourSchema,
    hGvn: optionalHourSchema,
});

// Esquema para gvnType_hour (pilots)
const gvnTypeHourSchema = z.object({
    hIit: optionalHourSchema,
    hAnvis: optionalHourSchema,
});

// Esquema para formation_hour (pilots)
const formationHourSchema = z.object({
    hfDay: optionalHourSchema,
    hfGvn: optionalHourSchema,
});

// Esquema para app (approaches - pilots)
const appSchema = z.object({
    precision: optionalNumberSchema,
    noPrecision: optionalNumberSchema,
    td: optionalNumberSchema,
    sp: optionalNumberSchema,
});

// Esquema para landing (aterrizajes - pilots)
const landingTypeSchema = z.object({
    lDay: optionalNumberSchema,
    lNight: optionalNumberSchema,
    lGvn: optionalNumberSchema,
});

const landingSchema = z.object({
    tierra: landingTypeSchema,
    mono: landingTypeSchema,
    multi: landingTypeSchema,
    carrier: landingTypeSchema,
});

// Esquema para projectile (dvs)
const projectileSchema = z.object({
    m3m: optionalNumberSchema,
    mag58: optionalNumberSchema,
});

// Esquema para pilots - name es número requerido
const pilotSchema = z.object({
    name: z.number({ required_error: "Requerido" }),
    person_hour: personHourSchema,
    ift_hour: optionalHourSchema,
    gvnType_hour: gvnTypeHourSchema,
    instructor_hour: optionalHourSchema,
    formation_hour: formationHourSchema,
    app: appSchema,
    landing: landingSchema,
});

// Esquema para dvs - name es número requerido
const dvSchema = z.object({
    name: z.number({ required_error: "Requerido" }),
    person_hour: personHourSchema,
    wt_hour: optionalHourSchema,
    projectile: projectileSchema,
});

// Sub-esquema para cada papeleta seleccionada individualmente
const papeletaItemSchema = z.object({
    sk: z.number(),
    period: z.enum(['dia', 'gvn']),
});

// Esquema para papeletas
const papeletaSchema = z.object({
    crew: z.array(z.number()),
    papeleta: z.array(papeletaItemSchema),
});

// Esquema para cupos - autoridad es número requerido
const cupoSchema = z.object({
    autoridad: z.number({ required_error: "Requerido" }),
    horas: requiredHourSchema,
});

// Esquema para pasajeros - tipo es número requerido
const pasajeroSchema = z.object({
    tipo: z.number({ required_error: "Requerido" }),
    cantidad: requiredNumberSchema,
    ruta: z.string().min(1, "La ruta es requerida").max(100, "Máximo 100 caracteres"),
});

const timeRegexHHMM = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

// Esquema para general
const generalSchema = z.object({
    date: z.string().min(1, "Requerido"),
    departurePlace: z.number({ required_error: "Requerido" }),
    departureTime: z.string().min(1, "Requerido").regex(timeRegexHHMM, "Formato HH:MM"),
    arrivalPlace: z.number({ required_error: "Requerido" }),
    arrivalTime: z.string().min(1, "Requerido").regex(timeRegexHHMM, "Formato HH:MM"),
    aircraft: z.number({ required_error: "Requerido" }),
    event: z.number({ required_error: "Requerido" }),
    totalHours: requiredHourSchema,
});

// Esquema principal
export const formSchema = z.object({
    general: generalSchema,
    pilots: z.array(pilotSchema).min(1, "Debe haber al menos un piloto"),
    dvs: z.array(dvSchema),
    papeletas: z.array(papeletaSchema),
    cupos: z.array(cupoSchema),
    pasajeros: z.array(pasajeroSchema),
});

// Tipo TypeScript derivado del esquema
export type FormData = z.infer<typeof formSchema>;

// Tipo para los valores por defecto (permite undefined para campos requeridos)
export type FormDefaultValues = {
    general: {
        date: string;
        departurePlace?: number;
        departureTime: string;
        arrivalPlace?: number;
        arrivalTime: string;
        aircraft?: number;
        event?: number;
        totalHours: string;
    };
    pilots: Array<Partial<FormData['pilots'][number]> & { name?: number }>;
    dvs: Array<Partial<FormData['dvs'][number]> & { name?: number }>;
    papeletas: Array<{ crew: number[]; papeleta: { sk: number; period: 'dia' | 'gvn' }[] }>;
    cupos: Array<Partial<FormData['cupos'][number]> & { autoridad?: number }>;
    pasajeros: Array<Partial<FormData['pasajeros'][number]> & { tipo?: number }>;
};

export interface CardProps {
    index: number;
    control: Control<FormData>;
    errors: FieldErrors<FormData>;
    onRemove: (index: number) => void;
    canRemove?: boolean;
    selectedSks?: number[];
}

export interface ClassNameState {
    isFocused: boolean;
    isSelected?: boolean;
    isMulti?: boolean;
}

// Interfaces para las queries de los Selects
export interface Aircraft {
    aircraft_sk: number;
    aircraft_number: string;
}

export interface Event {
    event_sk: number;
    event: string;
}

export interface Crew {
    person_sk: number;
    person_nk: string;
}

export interface Papeleta {
    papeleta_sk: number;
    papeleta_name: string;
}

export interface Autoridad {
    authority_sk: number;
    authority_name: string;
}

export interface TipoPasajero {
    passenger_type_sk: number;
    passenger_type_name: string;
}