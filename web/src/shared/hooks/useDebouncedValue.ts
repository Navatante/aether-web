// src/shared/hooks/useDebouncedValue.ts
import { useEffect, useState } from "react";

/**
 * Devuelve `value` retardado: solo se actualiza cuando han pasado `delay` ms
 * sin que `value` cambie. Útil para búsquedas en vivo (1 efecto por pausa de
 * tecleo, no por pulsación). Encapsula el patrón setTimeout/clearTimeout para
 * no repetirlo en cada página con buscador.
 *
 * @example
 *   const [searchInput, setSearchInput] = useState('');
 *   const debouncedSearch = useDebouncedValue(searchInput, 300);
 *   // deriva los query params de `debouncedSearch`
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}
