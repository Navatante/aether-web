import { FieldErrors } from "react-hook-form";
import { FormData, ClassNameState } from "../components/forms/schema";
import { getNestedError } from './formHelpers';

/**
 * Genera las classNames para react-select basándose en el estado de error y valor.
 * Extraído para evitar duplicación en múltiples componentes de Card.
 *
 * @param errors - Objeto de errores de react-hook-form
 * @param errorPath - Path al campo para verificar errores (ej: "pilots.0.name")
 * @param hasValue - Si el select tiene un valor seleccionado
 * @returns Objeto de classNames para react-select
 */
export const getReactSelectClassNames = (
    errors: FieldErrors<FormData>,
    errorPath: string,
    hasValue: boolean
) => {
    const hasError = getNestedError(errors, errorPath);

    return {
        control: (state: ClassNameState): string => {
            const classes = ['react-select-control'];
            if (hasError) classes.push('react-select-control--error');
            else if (hasValue) classes.push('react-select-control--filled');
            if (state.isFocused) classes.push('react-select-control--focused');
            return classes.join(' ');
        },
        valueContainer: (): string => 'react-select-value-container',
        singleValue: (): string => 'react-select-single-value',
        placeholder: (): string => 'react-select-placeholder',
        input: (): string => 'react-select-input',
        menu: (): string => 'react-select-menu',
        menuList: (): string => 'react-select-menu-list',
        option: (state: ClassNameState): string => {
            const classes = ['react-select-option'];
            if (state.isFocused) classes.push('react-select-option--focused');
            if (state.isSelected) classes.push('react-select-option--selected');
            return classes.join(' ');
        },
        indicatorSeparator: (): string => 'react-select-indicator-separator',
        dropdownIndicator: (): string => 'react-select-dropdown-indicator',
        clearIndicator: (): string => 'react-select-clear-indicator',
        loadingIndicator: (): string => 'react-select-loading-indicator'
    };
};

/**
 * Versión para multi-select que incluye clases adicionales para valores múltiples.
 *
 * @param errors - Objeto de errores de react-hook-form
 * @param errorPath - Path al campo para verificar errores
 * @param hasValue - Si el select tiene valores seleccionados
 * @returns Objeto de classNames para react-select con soporte multi
 */
export const getReactSelectMultiClassNames = (
    errors: FieldErrors<FormData>,
    errorPath: string,
    hasValue: boolean
) => {
    const hasError = getNestedError(errors, errorPath);

    return {
        control: (state: ClassNameState): string => {
            const classes = ['react-select-control'];
            if (hasError) classes.push('react-select-control--error');
            else if (hasValue) classes.push('react-select-control--filled');
            if (state.isFocused) classes.push('react-select-control--focused');
            if (state.isMulti) classes.push('react-select-control--is-multi');
            return classes.join(' ');
        },
        valueContainer: (): string => 'react-select-value-container',
        singleValue: (): string => 'react-select-single-value',
        multiValue: (): string => 'react-select-multi-value',
        multiValueLabel: (): string => 'react-select-multi-value-label',
        multiValueRemove: (): string => 'react-select-multi-value-remove',
        placeholder: (): string => 'react-select-placeholder',
        input: (): string => 'react-select-input',
        menu: (): string => 'react-select-menu',
        menuList: (): string => 'react-select-menu-list',
        option: (state: ClassNameState): string => {
            const classes = ['react-select-option'];
            if (state.isFocused) classes.push('react-select-option--focused');
            if (state.isSelected) classes.push('react-select-option--selected');
            return classes.join(' ');
        },
        indicatorSeparator: (): string => 'react-select-indicator-separator',
        dropdownIndicator: (): string => 'react-select-dropdown-indicator',
        clearIndicator: (): string => 'react-select-clear-indicator',
        loadingIndicator: (): string => 'react-select-loading-indicator'
    };
};

/**
 * Estilos comunes para el portal del menú de react-select.
 * Asegura que el menú se renderice correctamente sobre otros elementos.
 */
export const menuPortalStyles = {
    menuPortal: (base: Record<string, unknown>) => ({
        ...base,
        pointerEvents: "auto" as const,
        zIndex: 99999
    })
};
