import * as z from "zod"

// Schema de validación con Zod
export const formSchema = z.object({
    fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
    fechaFin: z.string().min(1, "La fecha fin es requerida"),
    tipo: z.string().min(1, "El tipo es requerido"),
    lugar: z.string().min(1, "El lugar es requerido"),
    generaEsfuerzo: z.boolean()
}).refine((data) => {
    const inicio = new Date(data.fechaInicio);
    const fin = new Date(data.fechaFin);
    return fin >= inicio;
}, {
    message: "La fecha fin debe ser mayor o igual a la fecha de inicio",
    path: ["fechaFin"]
});

export type FormValues = z.infer<typeof formSchema>;

export interface ComisionType {
    comision_type_sk: number;
    name: string;
    origin: string;
}

export interface ComisionLugar {
    comision_lugar_sk: number;
    comision_name: string;
}