// Modelo del dominio de ausencias: tipos, catálogo de motivos y helpers.
// Compartido por RegisterAbsenceDialog, los tooltips y Disponibilidad.

export interface Person {
    person_sk: number;
    full_name: string;
    person_rol: string;
    escala: string;
}

export interface Absence {
    absence_sk: number;
    absence_start_date: string;
    absence_end_date: string;
    absence_dias: number;
    absence_person_fk: number;
    absence_reason: string;
    absence_remark: string | null;
}

export interface PersonComision {
    person_comision_sk: number;
    person_fk: number;
    comision_start_date: string;
    comision_end_date: string;
    comision_dias: number;
    comision_lugar: string;
}

export interface AbsenceReason {
    label: string;
    color: string;
}

export interface NewAbsenceData {
    personId: number | '';
    startDate: Date | undefined;
    endDate: Date | undefined;
    reason: string;
    remark?: string;
}

export type DialogMode = 'create' | 'view' | 'edit' | 'view-comision';

// ==================== CATÁLOGO DE MOTIVOS ====================

export const absenceReasonColors: Record<string, AbsenceReason> = {
    'Permiso': { label: 'Permiso', color: 'oklch(0.568 0.111 146.545)' },
    'Asuntos propios': { label: 'Asuntos propios', color: 'oklch(0.566 0.057 163.845)' },
    'Dia adicional': { label: 'Dia adicional', color: 'oklch(0.743 0.084 164.484)' },
    'Baja médica': { label: 'Baja médica', color: 'oklch(0.623 0.127 18.979)' },
    'Guardia': { label: 'Guardia', color: 'oklch(0.785 0.139 96.303)' },
    'Saliente': { label: 'Saliente', color: 'oklch(0.87 0.116 105.302)' },
    'Curso': { label: 'Curso', color: 'oklch(0.709 0.107 65.486)' },
    'Reconocimiento médico': { label: 'Reconocimiento médico', color: 'oklch(0.91 0 89.876)' },
    'Dunker': { label: 'Dunker', color: 'oklch(0.727 0.092 213.697)' },
    'Vuelo día': { label: 'Vuelo día', color: '' },
    'Vuelo noche': { label: 'Vuelo noche', color: '' },
    'Otro': { label: 'Otro', color: 'oklch(0.55 0.02 265)' },
};

const defaultReasonColor: AbsenceReason = { label: 'Otro', color: '#6B7280' };

// Motivos restringidos por nivel de permiso (espejo del gating del backend).
export const ADMIN_ONLY_REASONS = ['Permiso', 'Asuntos propios', 'Dia adicional', 'Baja médica', 'Curso', 'Reconocimiento médico', 'Dunker'];
export const OPERATIONAL_ONLY_REASONS = ['Vuelo día', 'Vuelo noche', 'Guardia', 'Saliente'];

export const EMOJI_SUN = '☀️';
export const EMOJI_MOON = '🌑';

export const getReasonColor = (reason: string): AbsenceReason => {
    return absenceReasonColors[reason] || { ...defaultReasonColor, label: reason };
};

// ==================== HELPERS DE FECHA ====================

export const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
};

/** Parsea string de fecha a Date; undefined si no es válida. */
export const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
};
