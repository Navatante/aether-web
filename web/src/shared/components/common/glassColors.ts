// Paletas de estado de las GlassProgressBar (Big y Small).
//
// EXCEPCIÓN DOCUMENTADA al sistema de tokens de app/theme.css: estos rgba se
// interpolan en gradientes/sombras inline de una animación decorativa y no
// cambian entre temas, así que viven aquí en vez de en CSS vars. No añadir
// más colores literales fuera de este archivo (guard: `make theme-guard`).

export const GLASS_GREEN_COLORS = {
    primary: "rgba(34, 197, 94, 0.7)",
    secondary: "rgba(74, 222, 128, 0.5)",
    glow: "rgba(134, 239, 172, 0.8)",
    particles: "rgba(187, 247, 208, 0.9)",
} as const;

export const GLASS_ORANGE_COLORS = {
    primary: "rgba(249, 115, 22, 0.7)",
    secondary: "rgba(251, 146, 60, 0.5)",
    glow: "rgba(253, 186, 116, 0.8)",
    particles: "rgba(254, 215, 170, 0.9)",
} as const;

export const GLASS_RED_COLORS = {
    primary: "rgba(239, 68, 68, 0.7)",
    secondary: "rgba(248, 113, 113, 0.5)",
    glow: "rgba(252, 165, 165, 0.8)",
    particles: "rgba(254, 202, 202, 0.9)",
} as const;

export type GlassStatusColors =
    | typeof GLASS_GREEN_COLORS
    | typeof GLASS_ORANGE_COLORS
    | typeof GLASS_RED_COLORS;

/** Paleta de estado según porcentaje (verde > 80, naranja >= 40, rojo resto). */
export function getEtherealColors(percentage: number): GlassStatusColors {
    if (percentage > 80) return GLASS_GREEN_COLORS;
    if (percentage >= 40) return GLASS_ORANGE_COLORS;
    return GLASS_RED_COLORS;
}
