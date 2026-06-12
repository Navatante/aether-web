// ======================================
// Tipos para las estadísticas estáticas
// ======================================

export interface DashboardStaticStats {
    pilotos: PilotStats;
    tripulacion_cabina: TripulacionCabinaStats;
    mantenedores: MantenedoresStats;
    administrativos: AdministrativosStats;
    personal_total: PersonalTotalStats;
    crp: number;
    airflow: number
}

export interface PilotStats {
    total: number;
    pqm: number;
    h2p: number;
    hac: number;
    ip: number;
    fcp: number;
    ip_fcp: number;
}

export interface TripulacionCabinaStats {
    total: number;
    alumnos:number;
    dotaciones:number;
    cabezas:number;
    dv_instructores:number;
    dv_pruebas:number;
    dv_instructores_y_pruebas:number;
    nadadores:number;
}

export interface MantenedoresStats {
    total: number;
    b1: number;
    b2: number;
    lv: number;
}

export interface AdministrativosStats {
    total: number;
    detall: number;
    operaciones: number;
    mantenimiento: number;
}

export interface PersonalTotalStats {
    total: number;
    oficiales: number;
    suboficiales: number;
    tropa_marineria: number;
}

// ======================================
// Tipos para las estadísticas dinamicas
// ======================================
export interface DashboardDynamicStats {
    fechaInicio: string;
    fechaFin: string;
    resumenGeneral: ResumenGeneral;
    horasDeVuelo: HorasDeVuelo[];
    horasPorHelicoptero: HorasPorHelicoptero[];
    horasPorAutoridad: HorasPorAutoridad[];
    horasPorEventoLugar: HorasPorEventoLugar[];
    horasPorPeriodo: HorasPorPeriodo;
}

export interface ResumenGeneral {
    totalHoras: number;
    totalVuelos: number;
    horasSimulador: number;
    vuelosSimulador: number;
}

export interface HorasDeVuelo {
    date: string;
    real: number;
    simulador: number;
}

export interface HorasPorHelicoptero {
    helo: string;
    horas: number;
}

export interface HorasPorAutoridad {
    horas: number;
    autoridad: string;
    abreviatura: string;
}

export interface HorasPorEventoLugar {
    evento: string;
    lugares: Record<string, number>;
}

export interface HorasPorPeriodo {
    dia_real: number;
    dia_simulado: number;
    noche_sin_gafas_real: number;
    noche_sin_gafas_simulado: number;
    gvn_real: number;
    anvis_real: number;
    iit_real: number;
    gvn_simulado: number;
    anvis_simulado: number;
    iit_simulado: number;
}

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
// Tipos para los datos transformados de los gráficos
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