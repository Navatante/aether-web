// src/features/ratings/utils/hooks.ts
//
// Utilidades compartidas por las páginas de ratings. La lógica de datos vive
// en cada página con useApiQuery/useApiMutation (TanStack Query).

/**
 * Formatea una fecha para enviar al backend (YYYY-MM-DD) en hora local.
 */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
