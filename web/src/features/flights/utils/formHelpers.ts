import { FieldErrors } from "react-hook-form";
import { FormData } from "../components/forms/schema";

/**
 * Navega un objeto de errores usando un path separado por puntos.
 * Soporta tanto paths estáticos como dinámicos con índices de array.
 *
 * @param errors - Objeto de errores de react-hook-form
 * @param path - Path separado por puntos (ej: "pilots.0.name" o "general.helo")
 * @returns El error encontrado o undefined
 */
export const getNestedError = (errors: FieldErrors<FormData>, path: string): unknown => {
    return path.split('.').reduce<unknown>((obj, key) => {
        if (obj && typeof obj === 'object') {
            return (obj as Record<string, unknown>)[key];
        }
        return undefined;
    }, errors);
};
