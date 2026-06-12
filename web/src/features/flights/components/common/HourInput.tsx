import { Controller, Control, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { handleComaToPoint } from '@/lib/utils';
import { getInputClassName } from '../../utils';
import { FormData } from '../forms/schema';

interface HourInputProps {
    control: Control<FormData>;
    name: string;
    placeholder?: string;
    errors: FieldErrors<FormData>;
}

/**
 * Navega un objeto de errores usando un path separado por puntos.
 */
const getNestedError = (errors: FieldErrors<FormData>, path: string): unknown => {
    return path.split('.').reduce<unknown>((obj, key) => {
        if (obj && typeof obj === 'object') {
            return (obj as Record<string, unknown>)[key];
        }
        return undefined;
    }, errors);
};

/**
 * Input controlado para campos de horas.
 * Convierte comas a puntos automáticamente y aplica estilos de validación.
 */
function HourInput({ control, name, placeholder, errors }: HourInputProps) {
    const hasError = getNestedError(errors, name);

    return (
        <Controller
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={name as any}
            control={control}
            render={({ field }) => (
                <Input
                    {...field}
                    value={field.value as string}
                    type="text"
                    placeholder={placeholder}
                    className={getInputClassName(!!field.value, !!hasError)}
                    onChange={(e) => handleComaToPoint(e, field.onChange)}
                    autoComplete="off"
                />
            )}
        />
    );
}

export default HourInput;
