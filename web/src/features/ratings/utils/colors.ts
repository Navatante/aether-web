// src/features/ratings/utils/colors.ts
//
// Configuración de colores para cada tipo de rating.

// ============================================================================
// COLOR PALETTE
// ============================================================================

/**
 * Paleta de colores disponibles con sus clases CSS.
 */
export const COLOR_PALETTE = {
    blue: {
        base: 'blue',
        bg: 'bg-blue-500/20',
        bgHover: 'hover:bg-blue-500/30',
        border: 'border-blue-400',
        borderActive: 'border-blue-500',
        shadow: 'shadow-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        ring: 'ring-blue-500',
    },
    emerald: {
        base: 'emerald',
        bg: 'bg-emerald-500/20',
        bgHover: 'hover:bg-emerald-500/30',
        border: 'border-emerald-400',
        borderActive: 'border-emerald-500',
        shadow: 'shadow-emerald-500/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        ring: 'ring-emerald-500',
    },
    white: {
        base: 'white',
        bg: 'bg-white/20 dark:bg-gray-700/40',
        bgHover: 'hover:bg-white/30 dark:hover:bg-gray-700/60',
        border: 'border-gray-300 dark:border-gray-500',
        borderActive: 'border-gray-400 dark:border-gray-400',
        shadow: 'shadow-gray-500/20',
        text: 'text-gray-700 dark:text-gray-300',
        ring: 'ring-gray-400',
    },
    orange: {
        base: 'orange',
        bg: 'bg-orange-500/20',
        bgHover: 'hover:bg-orange-500/30',
        border: 'border-orange-400',
        borderActive: 'border-orange-500',
        shadow: 'shadow-orange-500/20',
        text: 'text-orange-600 dark:text-orange-400',
        ring: 'ring-orange-500',
    },
    red: {
        base: 'red',
        bg: 'bg-red-500/20',
        bgHover: 'hover:bg-red-500/30',
        border: 'border-red-400',
        borderActive: 'border-red-500',
        shadow: 'shadow-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        ring: 'ring-red-500',
    },
    cyan: {
        base: 'cyan',
        bg: 'bg-cyan-500/20',
        bgHover: 'hover:bg-cyan-500/30',
        border: 'border-cyan-400',
        borderActive: 'border-cyan-500',
        shadow: 'shadow-cyan-500/20',
        text: 'text-cyan-600 dark:text-cyan-400',
        ring: 'ring-cyan-500',
    },
    teal: {
        base: 'teal',
        bg: 'bg-teal-500/20',
        bgHover: 'hover:bg-teal-500/30',
        border: 'border-teal-400',
        borderActive: 'border-teal-500',
        shadow: 'shadow-teal-500/20',
        text: 'text-teal-600 dark:text-teal-400',
        ring: 'ring-teal-500',
    },
    indigo: {
        base: 'indigo',
        bg: 'bg-indigo-500/20',
        bgHover: 'hover:bg-indigo-500/30',
        border: 'border-indigo-400',
        borderActive: 'border-indigo-500',
        shadow: 'shadow-indigo-500/20',
        text: 'text-indigo-600 dark:text-indigo-400',
        ring: 'ring-indigo-500',
    },
    rose: {
        base: 'rose',
        bg: 'bg-rose-500/20',
        bgHover: 'hover:bg-rose-500/30',
        border: 'border-rose-400',
        borderActive: 'border-rose-500',
        shadow: 'shadow-rose-500/20',
        text: 'text-rose-600 dark:text-rose-400',
        ring: 'ring-rose-500',
    },
    amber: {
        base: 'amber',
        bg: 'bg-amber-500/20',
        bgHover: 'hover:bg-amber-500/30',
        border: 'border-amber-400',
        borderActive: 'border-amber-500',
        shadow: 'shadow-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        ring: 'ring-amber-500',
    },
    purple: {
        base: 'purple',
        bg: 'bg-purple-500/20',
        bgHover: 'hover:bg-purple-500/30',
        border: 'border-purple-400',
        borderActive: 'border-purple-500',
        shadow: 'shadow-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400',
        ring: 'ring-purple-500',
    },
    green: {
        base: 'green',
        bg: 'bg-green-500/20',
        bgHover: 'hover:bg-green-500/30',
        border: 'border-green-400',
        borderActive: 'border-green-500',
        shadow: 'shadow-green-500/20',
        text: 'text-green-600 dark:text-green-400',
        ring: 'ring-green-500',
    },
    gray: {
        base: 'gray',
        bg: 'bg-gray-500/20',
        bgHover: 'hover:bg-gray-500/30',
        border: 'border-gray-400',
        borderActive: 'border-gray-500',
        shadow: 'shadow-gray-500/20',
        text: 'text-gray-600 dark:text-gray-400',
        ring: 'ring-gray-500',
    },
    lime: {
        base: 'lime',
        bg: 'bg-lime-500/20',
        bgHover: 'hover:bg-lime-500/30',
        border: 'border-lime-400',
        borderActive: 'border-lime-500',
        shadow: 'shadow-lime-500/20',
        text: 'text-lime-600 dark:text-lime-400',
        ring: 'ring-lime-500',
    },
    yellow: {
        base: 'yellow',
        bg: 'bg-yellow-500/20',
        bgHover: 'hover:bg-yellow-500/30',
        border: 'border-yellow-400',
        borderActive: 'border-yellow-500',
        shadow: 'shadow-yellow-500/20',
        text: 'text-yellow-600 dark:text-yellow-400',
        ring: 'ring-yellow-500',
    },
} as const;

export type ColorName = keyof typeof COLOR_PALETTE;

// ============================================================================
// PAGE-SPECIFIC COLOR MAPS
// ============================================================================

/**
 * Mapa de colores para Model Ratings.
 * IDs 1-5: pilotos, IDs 6-11: dotaciones
 */
export const MODEL_RATINGS_COLORS: Record<number, ColorName> = {
    // Pilotos
    1: 'blue',       // Copiloto
    2: 'emerald',    // Comandante aeronave
    3: 'white',      // Piloto instructor
    4: 'orange',     // Piloto pruebas
    5: 'red',        // VFR Diurno
    // Dotaciones
    6: 'cyan',       // Dotacion alumno
    7: 'blue',       // Dotacion refresco/adaptacion
    8: 'emerald',    // Dotacion vuelo
    9: 'white',      // Cabeza dotacion
    10: 'orange',    // Dotacion instructor
    11: 'red',       // Dotacion pruebas
};

/**
 * Mapa de colores para General/Tactical Ratings.
 */
export const GENERAL_TACTICAL_COLORS: Record<number, ColorName> = {
    12: 'white',     // VFR Diurno
    13: 'red',       // VFR Nocturno
    14: 'lime',      // GVN
    15: 'orange',    // IFR
    16: 'blue',      // Aeronaval
    17: 'emerald',   // Anfibia
    18: 'yellow',    // Operaciones especiales
};

/**
 * Mapa de colores para Leadership Ratings.
 */
export const LEADERSHIP_COLORS: Record<number, ColorName> = {
    19: 'teal',      // Lider seccion
    20: 'indigo',    // Lider formacion
    21: 'rose',      // Comandante mision aerea
};

/**
 * Mapa de colores para Maintenance Ratings.
 */
export const MAINTENANCE_COLORS: Record<number, ColorName> = {
    1: 'teal',       // Mecanico
    2: 'amber',      // Avionica
    3: 'purple',     // Linea vuelo
};

/**
 * Colores para Operational Status (estados calculados).
 */
export const OPERATIONAL_STATUS_COLORS = {
    SA: 'red',       // Sin aptitud
    CA: 'orange',    // Con aptitud
    LCR: 'blue',     // Limitado combate
    CR: 'green',     // Preparado combate
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene el objeto de color para un rating ID dado un mapa de colores.
 */
export function getRatingColorClasses(
    ratingId: number,
    colorMap: Record<number, ColorName>
): typeof COLOR_PALETTE[ColorName] {
    const colorName = colorMap[ratingId] || 'gray';
    return COLOR_PALETTE[colorName];
}

/**
 * Obtiene el nombre del color para un rating ID.
 */
export function getRatingColorName(
    ratingId: number,
    colorMap: Record<number, ColorName>
): ColorName {
    return colorMap[ratingId] || 'gray';
}

/**
 * Genera las clases CSS para un botón de certificación.
 */
export function getCertificationButtonClasses(
    ratingId: number,
    colorMap: Record<number, ColorName>,
    isCertified: boolean,
    isDisabled: boolean
): string {
    const color = COLOR_PALETTE[colorMap[ratingId] || 'gray'];

    const baseClasses = 'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 border-2';

    if (isDisabled) {
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50`;
    }

    if (isCertified) {
        return `${baseClasses} ${color.bg} ${color.border} ${color.shadow} shadow-md cursor-pointer`;
    }

    return `${baseClasses} bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${color.bgHover} cursor-pointer`;
}

/**
 * Genera las clases CSS para el badge de estado (GeneralTactical).
 */
export function getStateBadgeClasses(state: string): string {
    switch (state) {
        case 'Calificado':
            return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'En transicion':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
}
