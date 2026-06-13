import { cn } from "@/lib/utils";

// Helpers para congelar la primera columna en tablas con scroll horizontal.
//
// Capas z-index (consistentes en todas las matrices):
//   celdas normales: auto · 1ª columna cuerpo: z-10 ·
//   resto de cabecera (dentro de StickyTableHeader): z-20 · esquina: z-30.
// El bg-* de la celda fija tapa lo que scrollea por detrás; el border-r da
// la separación visual / señal de scroll.

/** Clases para la celda de cuerpo de la 1ª columna congelada. */
export function stickyFirstColClass(index: number, extra?: string) {
  return cn(
    "sticky left-0 z-10 border-r border-border",
    index % 2 === 0 ? "bg-table-sticky-even" : "bg-table-sticky-odd",
    extra,
  );
}

/** Celda esquina superior-izquierda (por encima de cabecera y columna sticky). */
export const STICKY_CORNER =
  "sticky left-0 z-30 bg-table-header border-r border-border";
