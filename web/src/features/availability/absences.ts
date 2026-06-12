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

// Los valores viven en app/theme.css (tokens --absence-*).
export const absenceReasonColors: Record<string, AbsenceReason> = {
    'Permiso': { label: 'Permiso', color: 'var(--absence-permiso)' },
    'Asuntos propios': { label: 'Asuntos propios', color: 'var(--absence-asuntos-propios)' },
    'Dia adicional': { label: 'Dia adicional', color: 'var(--absence-dia-adicional)' },
    'Baja médica': { label: 'Baja médica', color: 'var(--absence-baja-medica)' },
    'Guardia': { label: 'Guardia', color: 'var(--absence-guardia)' },
    'Saliente': { label: 'Saliente', color: 'var(--absence-saliente)' },
    'Curso': { label: 'Curso', color: 'var(--absence-curso)' },
    'Reconocimiento médico': { label: 'Reconocimiento médico', color: 'var(--absence-reconocimiento)' },
    'Dunker': { label: 'Dunker', color: 'var(--absence-dunker)' },
    'Vuelo día': { label: 'Vuelo día', color: '' },
    'Vuelo noche': { label: 'Vuelo noche', color: '' },
    'Otro': { label: 'Otro', color: 'var(--absence-otro)' },
};

const defaultReasonColor: AbsenceReason = { label: 'Otro', color: 'var(--absence-default)' };

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
