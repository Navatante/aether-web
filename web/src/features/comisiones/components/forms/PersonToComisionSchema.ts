import * as z from "zod"

// Schema de validación con Zod
export const personToComisionFormSchema = z.object({
    comision: z.string().min(1, "La comision es requerida"),
    personas: z.array(z.string())
        .min(1, "Debe seleccionar al menos una persona"),
    // Días de ranchería por participante (subconjunto de personas).
    rancheria: z.array(z.object({
        persona: z.string(),
        dias: z.number().int().positive(),
    })),
});

export type PersonToComisionFormValues = z.infer<typeof personToComisionFormSchema>;

export interface Comision {
    comision_sk: number;
    lugar: string;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    esfuerzo: number;
}

export interface PersonToComisionPerson {
    person_sk: number,
    person_rank: string,
    person_name: string,
    person_last_name_1: string,
    person_last_name_2: string,
}