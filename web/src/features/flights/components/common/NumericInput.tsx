import { Controller, Control, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { handleComaToPoint } from '@/lib/utils';
import { getInputClassName } from '../../utils';
import { getNestedError } from '../../utils/formHelpers';
import { FormData } from '../forms/schema';

interface NumericInputProps {
    control: Control<FormData>;
    name: string;
    placeholder?: string;
    errors: FieldErrors<FormData>;
    mode: 'hour' | 'integer';
}

function NumericInput({ control, name, placeholder, errors, mode }: NumericInputProps) {
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
                    onChange={mode === 'hour'
                        ? (e) => handleComaToPoint(e, field.onChange)
                        : (e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    autoComplete="off"
                />
            )}
        />
    );
}

export default NumericInput;
