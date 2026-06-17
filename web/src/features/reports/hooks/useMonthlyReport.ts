// useMonthlyReport — datos del informe mensual de prueba.
// Recibe { month, year }, deriva el rango del MES COMPLETO y reúne datos de
// varios dominios (de momento: dashboard static + dynamic). Reutiliza los
// endpoints existentes; no toca el backend.

import { useApiQuery } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers/UserProvider";
import type {
    DashboardStaticStats,
    DashboardDynamicStats,
    DashboardStatsParams,
} from "@/types/dashboard";

export interface MonthlyReportData {
    month: number;            // 1-12
    year: number;
    monthLabel: string;       // "junio 2026"
    escuadrillaName: string | null;
    rangeFrom: string;        // YYYY-MM-DD
    rangeTo: string;          // YYYY-MM-DD
    static: DashboardStaticStats;
    dynamic: DashboardDynamicStats;
}

export interface MonthlyReportResult {
    isLoading: boolean;
    error: string | null;
    data: MonthlyReportData | null;
}

const MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function useMonthlyReport(month: number, year: number): MonthlyReportResult {
    const { id: escuadrillaId, name: escuadrillaName } = useEscuadrilla();

    // Rango del mes completo [día 1 .. último día].
    const rangeFrom = toISODate(new Date(year, month - 1, 1));
    const rangeTo = toISODate(new Date(year, month, 0));

    const dynamicParams: DashboardStatsParams = {
        range_type: "custom",
        date_from: rangeFrom,
        date_to: rangeTo,
    };

    const enabled = escuadrillaId !== null;

    const staticQ = useApiQuery<DashboardStaticStats>(
        "GET",
        "/dashboard/static-stats",
        { enabled },
        queryKeys.dashboard.static(escuadrillaId ?? 0),
    );

    const dynamicQ = useApiQuery<DashboardDynamicStats>(
        "POST",
        "/dashboard/dynamic-stats",
        { body: dynamicParams, enabled },
        queryKeys.dashboard.dynamic(escuadrillaId ?? 0, dynamicParams as unknown as Record<string, unknown>),
    );

    const error = staticQ.error?.message ?? dynamicQ.error?.message ?? null;
    // "Cargando" hasta tener ambos datos o un error: cubre también la ventana en
    // que las queries están deshabilitadas (escuadrillaId aún sin resolver), para
    // que el autoprint no dispare con el documento vacío.
    const isLoading = !error && (!staticQ.data || !dynamicQ.data);

    const data: MonthlyReportData | null =
        !isLoading && !error && staticQ.data && dynamicQ.data
            ? {
                  month,
                  year,
                  monthLabel: `${MONTHS_ES[month - 1]} ${year}`,
                  escuadrillaName,
                  rangeFrom,
                  rangeTo,
                  static: staticQ.data,
                  dynamic: dynamicQ.data,
              }
            : null;

    return { isLoading, error, data };
}
