// src/features/ratings/types.ts
//
// Tipos e interfaces compartidas para todas las páginas de ratings.

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Estado de una certificación individual.
 */
export interface CertificationStatus {
    certified: boolean;
    date_qualified?: string;
    // Campos opcionales para GeneralTacticalRatings
    state?: string;
    person_rol?: string;
    // Estadísticas opcionales
    total_horas_VFR_diurno_365?: number;
    total_horas_VFR_nocturno_365?: number;
    total_horas_GVN_90?: number;
    total_horas_GVN_365?: number;
    total_horas_IFR_365?: number;
    total_app_precision_365?: number;
    total_app_no_precision_365?: number;
    total_tomas_dia_buque_182?: number;
    total_tomas_dia_mono_182?: number;
    total_tomas_dia_multi_182?: number;
    total_tomas_dia_carrier_182?: number;
    total_tomas_nocheConv_buque_182?: number;
    total_tomas_nocheConv_mono_182?: number;
    total_tomas_nocheConv_multi_182?: number;
    total_tomas_nocheConv_carrier_182?: number;
    total_tomas_GVN_buque_182?: number;
    total_tomas_GVN_mono_182?: number;
    total_tomas_GVN_multi_182?: number;
    total_tomas_GVN_carrier_182?: number;
}

/**
 * Mapa de certificaciones por rating ID.
 */
export interface Certification {
    [ratingId: number]: CertificationStatus;
}

/**
 * Mapa de certificaciones por persona (usando person_nk o full_name como key).
 */
export interface CertificationData {
    [personKey: string]: Certification;
}

// ============================================================================
// RATING TYPES
// ============================================================================

/**
 * Rating base para crew ratings.
 */
export interface Rating {
    crew_rating_sk: number;
    name: string;
    abbreviation: string;
}

/**
 * Rating para notCrew ratings (mantenimiento).
 */
export interface NotCrewRating {
    notCrew_rating_sk: number;
    notCrew_rating_name: string;
    notCrew_rating_abrv: string;
}

/**
 * Registro de calificación de crew.
 */
export interface QualificationRecord {
    crew_rating_sk: number;
    person_sk: number;
    person_nk: string;
    full_name: string;
    crew_ratings_fk: number;
    date_qualified: string;
    state?: string;
    // Estadísticas opcionales (GeneralTactical)
    total_horas_VFR_diurno_365?: number;
    total_horas_VFR_nocturno_365?: number;
    total_horas_GVN_90?: number;
    total_horas_GVN_365?: number;
    total_horas_IFR_365?: number;
    total_app_precision_365?: number;
    total_app_no_precision_365?: number;
    total_tomas_dia_buque_182?: number;
    total_tomas_dia_mono_182?: number;
    total_tomas_dia_multi_182?: number;
    total_tomas_dia_carrier_182?: number;
    total_tomas_nocheConv_buque_182?: number;
    total_tomas_nocheConv_mono_182?: number;
    total_tomas_nocheConv_multi_182?: number;
    total_tomas_nocheConv_carrier_182?: number;
    total_tomas_GVN_buque_182?: number;
    total_tomas_GVN_mono_182?: number;
    total_tomas_GVN_multi_182?: number;
    total_tomas_GVN_carrier_182?: number;
}

/**
 * Registro de calificación de notCrew (mantenimiento).
 */
export interface NotCrewQualificationRecord {
    notCrew_ratings_sk: number;
    person_sk: number;
    full_name: string;
    notCrew_rating_fk: number;
    date_qualified: string;
}

// ============================================================================
// PERSON TYPES
// ============================================================================

/**
 * Persona con sus calificaciones (crew).
 */
export interface PersonWithRatings {
    person_sk: number;
    person_nk: string;
    full_name: string;
    person_type?: string;
    person_rol?: string;
    calificaciones?: QualificationRecord[];
}

/**
 * Persona con sus calificaciones (notCrew/mantenimiento).
 */
export interface PersonWithNotCrewRatings {
    person_sk: number;
    full_name: string;
    person_rol?: string;
    calificaciones?: NotCrewQualificationRecord[];
}

// ============================================================================
// DATA TYPES (API Responses)
// ============================================================================

/**
 * Datos de Model Ratings desde la API.
 */
export interface ModelRatingsData {
    calificaciones_modelo_pilotos: Rating[];
    calificaciones_modelo_dotaciones: Rating[];
    todos_pilotos: PersonWithRatings[];
    todas_dotaciones: PersonWithRatings[];
}

/**
 * Datos de General/Tactical Ratings desde la API.
 */
export interface GeneralTacticalRatingsData {
    calificaciones_generalTactica_soloPilotos: Rating[];
    calificaciones_generalTactica_soloDotaciones: Rating[];
    calificaciones_generalTactica_compartida: Rating[];
    todos_pilotos: PersonWithRatings[];
    todas_dotaciones: PersonWithRatings[];
}

/**
 * Datos de Leadership Ratings desde la API.
 */
export interface LeadershipRatingsData {
    calificaciones_mandoYliderazgo_pilotos: Rating[];
    todos_pilotos: PersonWithRatings[];
}

/**
 * Datos de Maintenance Ratings desde la API.
 */
export interface MaintenanceRatingsData {
    calificaciones_mantenimiento: NotCrewRating[];
    todos_mantenedores: PersonWithNotCrewRatings[];
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Modo de vista: pilotos o dotaciones/crew.
 */
export type ViewMode = 'pilots' | 'crew';

/**
 * Target para eliminación de certificación.
 */
export interface DeleteTarget {
    personKey: string;
    ratingId: number;
}

/**
 * Configuración para un tipo de rating page.
 */
export interface RatingPageConfig<TData> {
    /** Comando de Tauri para obtener los datos */
    fetchCommand: string;
    /** Comando para agregar certificación */
    addCommand: string;
    /** Comando para eliminar certificación */
    deleteCommand: string;
    /** Título de la página */
    title: string;
    /** Si soporta vista de pilotos/crew */
    hasViewModeToggle: boolean;
    /** Si es solo lectura (ej: OperationalRatings) */
    readOnly?: boolean;
    /** Nivel de permiso requerido para editar */
    requiredPermission?: 'OPERACIONAL' | 'ADMINISTRATIVO';
    /** Función para procesar los datos */
    processData: (data: TData) => ProcessedRatingData;
    /** Mapa de colores para los ratings */
    colorMap: Record<number, string>;
    /** Función para determinar si un botón está deshabilitado */
    isButtonDisabled?: (personKey: string, ratingId: number, certifications: CertificationData) => boolean;
}

/**
 * Datos procesados listos para renderizar.
 */
export interface ProcessedRatingData {
    pilotCertifications: CertificationData;
    crewCertifications?: CertificationData;
    pilots: string[];
    crew?: string[];
    pilotRatings: Rating[];
    crewRatings?: Rating[];
    personFullNameMap: Record<string, string>;
    personSkMap: Record<string, number>;
}

