// reportRegistry — catálogo de informes imprimibles.
// Añadir un informe nuevo = crear su hook de datos + documento + vista, y
// registrar aquí una entrada. La ruta /print/:reportId resuelve por esta clave.

import type { ComponentType } from "react";
import { MonthlyReportView } from "./views/MonthlyReportView";

/** Props que recibe toda vista de informe (mes/año del periodo + autoprint). */
export interface ReportViewProps {
    month: number; // 1-12
    year: number;
    autoprint: boolean;
}

export interface ReportEntry {
    /** Título legible (barra de acciones, selector de informe…). */
    title: string;
    /** Componente que monta el informe completo. */
    View: ComponentType<ReportViewProps>;
}

export const reportRegistry: Record<string, ReportEntry> = {
    monthly: {
        title: "Informe mensual de operaciones",
        View: MonthlyReportView,
    },
};

export type ReportId = keyof typeof reportRegistry;
