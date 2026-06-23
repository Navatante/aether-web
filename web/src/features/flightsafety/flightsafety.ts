// Modelo de la feature Seguridad de vuelo: constantes, configuración por tipo de
// reconocimiento y helpers puros (estado derivado, caducidad, fechas). Sin
// fetching ni JSX. Los tipos del contrato vienen de types/generated/flightsafety.

import type { MedicalSummaryItem, ExamSummaryItem } from '@/types/generated/flightsafety';

// ============================================================
// Tipos de reconocimiento + configuración
// ============================================================

export type ExamType = 'medical' | 'dunker' | 'hyperbaric';

export interface ExamConfig {
    key: ExamType;
    /** Nombre largo (cabeceras, títulos). */
    label: string;
    /** Nombre corto (tarjetas del panel). */
    short: string;
    /** Path base del endpoint REST. */
    apiPath: string;
    /** Años de validez → caducidad = fecha + validityYears. */
    validityYears: number;
    /** Umbral ámbar: faltan <= amberDays días para caducar. */
    amberDays: number;
    /** Umbral rojo: faltan <= redDays días (o ya caducado). */
    redDays: number;
    /** medical lleva lugar + resultado de catálogo; dunker/hiperbárica resultado booleano. */
    booleanResult: boolean;
}

export const EXAM_CONFIG: Record<ExamType, ExamConfig> = {
    medical: {
        key: 'medical',
        label: 'Reconocimiento médico',
        short: 'Médico',
        apiPath: '/flight-safety/medical',
        validityYears: 1,
        amberDays: 60,
        redDays: 30,
        booleanResult: false,
    },
    dunker: {
        key: 'dunker',
        label: 'Dunker',
        short: 'Dunker',
        apiPath: '/flight-safety/dunker',
        validityYears: 1,
        amberDays: 60,
        redDays: 30,
        booleanResult: true,
    },
    hyperbaric: {
        key: 'hyperbaric',
        label: 'Hiperbárica',
        short: 'Hiperbárica',
        apiPath: '/flight-safety/hyperbaric',
        validityYears: 5,
        amberDays: 120,
        redDays: 60,
        booleanResult: true,
    },
};

// Regla CIMA: el reconocimiento médico debe hacerse en CIMA cada 4 años. Solo
// avisa, no bloquea.
export const CIMA_PLACE_NAME = 'CIMA';
export const CIMA_CYCLE_YEARS = 4;
// Aviso de CIMA con un año de antelación (el siguiente médico anual debería
// hacerse ya en CIMA).
export const CIMA_WARN_DAYS = 365;

// ============================================================
// Estado derivado
// ============================================================

export type ExamStatus =
    | 'VIGENTE'
    | 'POR_CADUCAR'
    | 'URGENTE'
    | 'CADUCADO'
    | 'PROGRAMADO'
    | 'SIN_DATOS';

export interface StatusMeta {
    label: string;
    /** Clases de badge (token semántico de theme.css). */
    badge: string;
    /** Clase de fondo de fila destacada (o ''). */
    row: string;
    /** Orden para clasificar (lo más urgente primero). */
    weight: number;
}

export const STATUS_META: Record<ExamStatus, StatusMeta> = {
    CADUCADO: { label: 'Caducado', badge: 'bg-danger-muted text-danger-muted-foreground border-danger/30', row: 'bg-danger-muted/40', weight: 0 },
    URGENTE: { label: 'Urgente', badge: 'bg-danger-muted text-danger-muted-foreground border-danger/30', row: 'bg-danger-muted/25', weight: 1 },
    POR_CADUCAR: { label: 'Por caducar', badge: 'bg-warning-muted text-warning-muted-foreground border-warning/30', row: 'bg-warning-muted/25', weight: 2 },
    PROGRAMADO: { label: 'Programado', badge: 'bg-info-muted text-info-muted-foreground border-info/30', row: 'bg-info-muted/20', weight: 3 },
    VIGENTE: { label: 'Vigente', badge: 'bg-success-muted text-success-muted-foreground border-success/30', row: '', weight: 4 },
    SIN_DATOS: { label: 'Sin datos', badge: 'bg-muted text-muted-foreground border-border', row: '', weight: 5 },
};

/** Fecha de hoy a medianoche local (para comparar días sin desfase horario). */
export function today(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parsea "YYYY-MM-DD" como fecha local a medianoche. "" / inválida → null. */
export function parseDate(s: string | undefined | null): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Días desde hoy hasta la fecha dada (negativo = pasado). null si no hay fecha. */
export function daysUntil(s: string | undefined | null, from: Date = today()): number | null {
    const d = parseDate(s);
    if (!d) return null;
    return Math.round((d.getTime() - from.getTime()) / 86_400_000);
}

/** Caducidad sugerida = fecha de examen + años de validez del tipo. */
export function computeExpiry(dateStr: string, type: ExamType): string {
    const d = parseDate(dateStr);
    if (!d) return '';
    const e = new Date(d.getFullYear() + EXAM_CONFIG[type].validityYears, d.getMonth(), d.getDate());
    return formatISO(e);
}

function formatISO(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Estado de un reconocimiento.
 *
 * Una cita de renovación abierta (`scheduled_date`) es la verdad operativa: la
 * renovación "ya está gestionada", así que PREVALECE sobre la caducidad (que sigue
 * visible en su propia columna). Gracias a esto, CADUCADO / URGENTE / POR_CADUCAR
 * quedan reservados para quien AÚN no tiene cita = lo que de verdad requiere acción
 * de Seguridad. Sin caducidad ni cita → SIN_DATOS.
 */
export function deriveStatus(
    item: { expiry_date: string; scheduled_date: string; done_date?: string },
    type: ExamType,
    from: Date = today(),
): ExamStatus {
    if (item.scheduled_date) return 'PROGRAMADO';
    const { amberDays, redDays } = EXAM_CONFIG[type];
    const days = daysUntil(item.expiry_date, from);
    if (days !== null) {
        if (days < 0) return 'CADUCADO';
        if (days <= redDays) return 'URGENTE';
        if (days <= amberDays) return 'POR_CADUCAR';
        return 'VIGENTE';
    }
    return 'SIN_DATOS';
}

// ============================================================
// CIMA
// ============================================================

export type CimaState = 'NONE' | 'DUE_SOON' | 'OVERDUE';

/** Estado del aviso CIMA (solo médico). */
export function cimaState(nextCimaDue: string | undefined, from: Date = today()): CimaState {
    const days = daysUntil(nextCimaDue, from);
    if (days === null) return 'NONE';
    if (days < 0) return 'OVERDUE';
    if (days <= CIMA_WARN_DAYS) return 'DUE_SOON';
    return 'NONE';
}

// ============================================================
// Personas
// ============================================================

type PersonLike = Pick<
    MedicalSummaryItem | ExamSummaryItem,
    'person_nk' | 'person_rank' | 'person_name' | 'person_last_name_1' | 'person_last_name_2'
>;

/** Nombre para mostrar sin indicativo: "Empleo Nombre Apellido1 Apellido2". */
export function personName(p: PersonLike): string {
    return [p.person_rank, p.person_name, p.person_last_name_1, p.person_last_name_2].filter(Boolean).join(' ');
}

/** Nombre para mostrar: "Empleo Nombre Apellido1 Apellido2 (NK)". */
export function personLabel(p: PersonLike): string {
    const name = personName(p);
    return p.person_nk ? `${name} (${p.person_nk})` : name;
}

/** Texto buscable de una persona (apellidos, nombre, NK). */
export function personSearchText(p: PersonLike & { person_name: string }): string {
    return [p.person_rank, p.person_name, p.person_last_name_1, p.person_last_name_2, p.person_nk]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}
