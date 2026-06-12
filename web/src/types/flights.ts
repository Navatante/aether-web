// types/flights.ts

/**
 * Datos principales de un vuelo
 */
export interface FlightData {
    id: number;
    fecha: string;
    hora: string;
    helicoptero: string;
    evento: string;
    cteAeronave: string;
    horas: number;
    detalles: FlightDetails;
}

/**
 * Detalles del vuelo
 */
export interface FlightDetails {
    tripulacion: {
        pilotos: CrewMember[];
        dotaciones: CrewMember[];
    };
    cuposAutoridad: CupoAutoridad[];
    pasajeros: Pasajero[];
}

/**
 * Miembro de tripulación (piloto o dotación)
 */
export interface CrewMember {
    nombre: string;
    nk: string;
    orden: number;
    horaVueloPiloto?: HorasVueloPiloto;
    horaVueloDotacion?: HorasVueloDotacion;
    tomas?: Tomas;
    aproximacionesInstr?: Aproximaciones;
    aproximacionesSar?: AproximacionesSar;
    proyectiles?: Proyectiles;
    papeletas?: Papeleta[];
}

/**
 * Horas de vuelo - Piloto
 */
export interface HorasVueloPiloto {
    dia: number;
    noche: number;
    gvn: {
        total: number;
        iit: number;
        anvis: number;
    };
    instrumentos: number;
    instructor: number;
    formacionDia: number;
    formacionGvn: number;
}

/**
 * Horas de vuelo - Dotación
 */
export interface HorasVueloDotacion {
    dia: number;
    noche: number;
    gvn: number;
    winchTrim: number;
}

/**
 * Tomas por tipo y condición
 */
export interface Tomas {
    dia: TomasPorTipo;
    nocheConv: TomasPorTipo;
    gvn: TomasPorTipo;
}

export interface TomasPorTipo {
    tierra: number;
    monospot: number;
    multispot: number;
    carrier: number;
}

/**
 * Aproximaciones instrumentales
 */
export interface Aproximaciones {
    precision: number;
    noPrecision: number;
}

/**
 * Aproximaciones SAR
 */
export interface AproximacionesSar {
    td: number;
    sp: number;
}

/**
 * Proyectiles disparados
 */
export interface Proyectiles {
    m3m: number;
    mag58: number;
}

/**
 * Papeleta de autorización o calificación
 */
export interface Papeleta {
    nombre: string;
    descripcion: string;
    periodo: number; // 1 = Dia, 3 = GVN
}

/**
 * Cupo de autoridad
 */
export interface CupoAutoridad {
    autoridad: string;
    horas: number;
}

/**
 * Información de pasajeros
 */
export interface Pasajero {
    tipo: string;
    cantidad: number;
    ruta: string;
}