import { z } from "zod";

// Base schema that doesn't depend on runtime data
export const basePapeletaSchema = z.object({
    papeleta_name: z
        .string()
        .min(1, "Requerido")
        .max(100),

    papeleta_description: z
        .string()
        .min(1, "Requerido")
        .max(200),

    papeleta_block: z.string().min(1, "Selecciona un bloque"),

    papeleta_plan: z.string().nullable(),

    papeleta_tv: z.number().nonnegative("Debe ser mayor o igual a cero").nullable(),

    papeleta_pilot_crp_value: z.number().int().positive("Debe ser positivo").nullable(),

    papeleta_dv_crp_value: z.number().int().positive("Debe ser positivo").nullable(),

    papeleta_expiration: z.number().int().positive("Debe ser positivo").nullable(),

    papeleta_order: z.number().int().positive("Debe ser positivo").nullable(),
});

// Function to create the schema dynamically with the data from the server
export function createPapeletaSchema(
    bloques: string[],
    planes: string[]
) {
    return z.object({
        papeleta_name: z
            .string()
            .min(1, "Requerido")
            .max(100),

        papeleta_description: z
            .string()
            .min(1, "Requerido")
            .max(200),

        papeleta_block: z.string().refine(
            val => bloques.includes(val),
            { message: "Selecciona un bloque válido" }
        ),

        papeleta_plan: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                return String(val);
            },
            z.union([
                z.string().refine(
                    val => planes.includes(val),
                    { message: "Selecciona un plan válido" }
                ),
                z.null()
            ])
        ),

        papeleta_tv: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            },
            z.union([
                z.number().nonnegative("Debe ser mayor o igual a cero"),
                z.null()
            ])
        ),

        papeleta_pilot_crp_value: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            },
            z.union([
                z.number().int().positive("Debe ser positivo"),
                z.null()
            ])
        ),

        papeleta_dv_crp_value: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            },
            z.union([
                z.number().int().positive("Debe ser positivo"),
                z.null()
            ])
        ),

        papeleta_expiration: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            },
            z.union([
                z.number().int().positive("Debe ser positivo"),
                z.null()
            ])
        ),

        papeleta_order: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            },
            z.union([
                z.number().int().positive("Debe ser positivo"),
                z.null()
            ])
        ),
    });
}

// Type for the form values
export type PapeletaFormValues = z.infer<typeof basePapeletaSchema>;