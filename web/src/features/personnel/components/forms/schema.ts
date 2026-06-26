// lib/schema.ts
import { z } from "zod";

// Cuerpos es el único que mantenemos hardcodeado ya que no viene del SP
export const CUERPOS = [
    "CGA",
    "CIM",
] as const;

// Utilidad para capitalizar las palabras
const capitalizeWords = (str: string): string => {
    return str
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Función para crear el esquema dinámicamente con los datos del servidor
export function createPersonSchema(
    roles: string[],
    empleos: string[],
    especialidades: string[],
    divisiones: string[],
    localidades: string[]
) {
    return z.object({
        person_nk: z
            .string()
            .transform(val => val.toUpperCase())
            .refine(
                val => val.length === 0 || /^[A-Z]{3}$/.test(val),
                { message: "Debe contener exactamente tres letras." }
            )
            .optional(),

        person_user: z.string().min(1, "Requerido").max(50),

        person_rank: z.string().refine(
            val => empleos.includes(val),
            { message: "Selecciona un empleo válido" }
        ),

        person_cuerpo: z.enum(CUERPOS, {
            required_error: "Selecciona un cuerpo",
            invalid_type_error: "Cuerpo no válido",
        }),

        person_especialidad: z.string().refine(
            val => especialidades.includes(val),
            { message: "Selecciona una especialidad válida" }
        ),

        person_name: z
            .string()
            .min(1, "Requerido")
            .max(100)
            .transform(capitalizeWords),

        person_last_name_1: z
            .string()
            .min(1, "Requerido")
            .max(100)
            .transform(capitalizeWords),

        person_last_name_2: z
            .string()
            .min(1, "Requerido")
            .max(100)
            .transform(capitalizeWords),

        person_phone: z.string()
            .min(1, "Requerido")
            .regex(/^[0-9]+$/, "Solo se permiten números")
            .min(9, "Debe tener al menos 9 dígitos")
            .max(15, "Máximo 15 dígitos"),

        person_dni: z.string()
            .trim()
            .transform(val => val.toUpperCase())
            .refine(
                val => !val || /^[0-9]{8}[A-Z]$/.test(val) || /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(val),
                { message: "Formato de DNI inválido" }
            )
            .optional(),

        person_localidad: z.string().refine(
            val => localidades.includes(val),
            { message: "Selecciona una localidad válida" }
        ),

        person_division: z.string().refine(
            val => divisiones.includes(val),
            { message: "Selecciona una división válida" }
        ),

        person_rol: z.string().refine(
            val => roles.includes(val),
            { message: "Selecciona un rol válido" }
        ),

        person_a_emp: z.date().optional().refine(Boolean, { message: "Requerido" }),

        person_f_emb: z.date().optional().refine(Boolean, { message: "Requerido" }),

        person_birthdate: z.date().optional().refine(Boolean, { message: "Requerido" }),

        person_num_escalafon: z.coerce.number().int().positive("Debe ser positivo"),
    });
}

export type PersonFormValues = z.infer<ReturnType<typeof createPersonSchema>>;