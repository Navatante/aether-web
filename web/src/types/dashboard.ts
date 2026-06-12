// Tipos del dashboard. La forma de la API viene GENERADA desde los structs
// Go (web/src/types/generated/dashboard.ts, regenerar con `make types`).
// Aquí solo se re-exportan con los nombres históricos del frontend y se
// añaden los tipos puramente de UI.

export type {
    StaticStats as DashboardStaticStats,
    PilotStats,
    TripulacionStats as TripulacionCabinaStats,
    MantenedoresStats,
    AdministrativosStats,
    PersonalTotalStats,
    DynamicStats as DashboardDynamicStats,
    ResumenGeneral,
    HorasDeVuelo,
    HorasHelicoptero as HorasPorHelicoptero,
    HorasAutoridad as HorasPorAutoridad,
    HorasEventoLugar as HorasPorEventoLugar,
    HorasPeriodo as HorasPorPeriodo,
} from './generated/dashboard';

// ======================================
// Tipos para los parámetros de consulta
// ======================================
export interface DashboardStatsParams {
    range_type: 'predefined' | 'custom';
    predefined_range?:
        | 'ultimos-7-dias'
        | 'ultimos-30-dias'
        | 'ultimos-90-dias'
        | 'ultimos-182-dias'
        | 'ultimos-365-dias'
        | 'semana-actual'
        | 'ultima-semana'
        | 'mes-actual'
        | 'ultimo-mes'
        | 'ultimos-3-meses'
        | 'anio-actual'
        | 'ultimo-anio'
        | 'ultimos-2-anios'
        | 'historico';
    date_from?: string;
    date_to?: string;
}

// ======================================
// Tipos para los datos transformados de los gráficos (solo UI)
// ======================================
export interface ChartDataPoint {
    date: string;
    real: number;
    simulador: number;
}

export interface HelicoperData {
    helo: string;
    horas: number;
}

export interface AutoridadData {
    autoridad: string;
    horas: number;
}

export interface BarChartData {
    evento: string;
    lugares: Record<string, number>;
}
