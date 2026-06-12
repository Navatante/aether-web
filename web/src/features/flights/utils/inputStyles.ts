import { cn } from "@/lib/utils";

/**
 * Genera las clases CSS para inputs según su estado.
 * Unifica el estilo de inputs en todas las Cards del formulario de vuelos.
 *
 * @param hasValue - Si el input tiene un valor
 * @param hasError - Si el campo tiene un error de validación
 * @param additionalClasses - Clases CSS adicionales opcionales
 * @returns String de clases CSS para el input
 */
export const getInputClassName = (
    hasValue: boolean,
    hasError: boolean,
    additionalClasses: string = ''
) => {
    return cn(
        'text-center transition-colors duration-200',
        additionalClasses,
        hasValue && !hasError && 'input-filled',
        hasError && 'border-destructive focus:border-destructive focus:ring-destructive'
    );
};

/**
 * Variante con min-width para inputs en Cards más pequeñas (Cupo, Pasajero).
 */
export const getInputClassNameCompact = (
    hasValue: boolean,
    hasError: boolean,
    additionalClasses: string = ''
) => {
    return getInputClassName(hasValue, hasError, cn('min-w-[50px]', additionalClasses));
};
