import { Controller, Control, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { getInputClassName } from '../../utils';
import { FormData } from '../forms/schema';

interface IntegerInputProps {
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
 * Input controlado para campos de números enteros.
 * Solo permite dígitos (0-9) y aplica estilos de validación.
 * Usado para campos como tomas (landings), aproximaciones, proyectiles, etc.
 */
function IntegerInput({ control, name, placeholder, errors }: IntegerInputProps) {
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
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        field.onChange(value);
                    }}
                    autoComplete="off"
                />
            )}
        />
    );
}

export default IntegerInput;
