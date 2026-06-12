// src/features/ratings/utils/processing.ts
//
// Funciones de procesamiento de datos para ratings.

import type {
    CertificationData,
    CertificationStatus,
    Rating,
    NotCrewRating,
    PersonWithRatings,
    PersonWithNotCrewRatings,
    ProcessedRatingData,
    ModelRatingsData,
    GeneralTacticalRatingsData,
    LeadershipRatingsData,
    MaintenanceRatingsData,
    QualificationRecord,
} from '../types';

// ============================================================================
// GENERIC PROCESSING FUNCTIONS
// ============================================================================

/**
 * Procesa certificaciones de personas con ratings de crew.
 * @param persons Lista de personas con sus calificaciones
 * @param ratings Lista de ratings disponibles
 * @param useNkAsKey Si usar person_nk como key (true) o full_name (false)
 * @param extraFields Función opcional para extraer campos adicionales de QualificationRecord
 */
export function processCertifications(
    persons: PersonWithRatings[],
    ratings: Rating[],
    useNkAsKey: boolean = true,
    extraFields?: (cal: QualificationRecord, person: PersonWithRatings) => Partial<CertificationStatus>
): CertificationData {
    const result: CertificationData = {};

    persons.forEach((person) => {
        const key = useNkAsKey ? person.person_nk : person.full_name;
        result[key] = {};

        // Inicializar todos los ratings como no certificados
        ratings.forEach((rating) => {
            result[key][rating.crew_rating_sk] = {
                certified: false,
                person_rol: person.person_rol,
            };
        });

        // Marcar las certificaciones que tiene la persona
        if (person.calificaciones && person.calificaciones.length > 0) {
            person.calificaciones.forEach((cal) => {
                const baseStatus: CertificationStatus = {
                    certified: true,
                    date_qualified: cal.date_qualified,
                    person_rol: person.person_rol,
                };

                // Agregar campos extra si se proporciona la función
                const extra = extraFields ? extraFields(cal, person) : {};

                result[key][cal.crew_ratings_fk] = { ...baseStatus, ...extra };
            });
        }
    });

    return result;
}

/**
 * Procesa certificaciones de notCrew (mantenimiento).
 */
export function processNotCrewCertifications(
    persons: PersonWithNotCrewRatings[],
    ratings: NotCrewRating[]
): CertificationData {
    const result: CertificationData = {};

    persons.forEach((person) => {
        result[person.full_name] = {};

        ratings.forEach((rating) => {
            result[person.full_name][rating.notCrew_rating_sk] = {
                certified: false,
            };
        });

        if (person.calificaciones && person.calificaciones.length > 0) {
            person.calificaciones.forEach((cal) => {
                result[person.full_name][cal.notCrew_rating_fk] = {
                    certified: true,
                    date_qualified: cal.date_qualified,
                };
            });
        }
    });

    return result;
}

/**
 * Construye el mapa de nombres completos.
 */
export function buildFullNameMap(
    pilots: PersonWithRatings[],
    crew?: PersonWithRatings[]
): Record<string, string> {
    const map: Record<string, string> = {};

    pilots.forEach((person) => {
        if (person.full_name) {
            map[person.person_nk] = person.full_name.trim();
        }
    });

    crew?.forEach((person) => {
        if (person.full_name) {
            map[person.person_nk] = person.full_name.trim();
        }
    });

    return map;
}

/**
 * Construye el mapa de person_sk por person_nk.
 */
export function buildPersonSkMap(
    pilots: PersonWithRatings[],
    crew?: PersonWithRatings[]
): Record<string, number> {
    const map: Record<string, number> = {};

    pilots.forEach((person) => {
        map[person.person_nk] = person.person_sk;
    });

    crew?.forEach((person) => {
        map[person.person_nk] = person.person_sk;
    });

    return map;
}

// ============================================================================
// PAGE-SPECIFIC PROCESSORS
// ============================================================================

/**
 * Procesa datos de Model Ratings.
 */
export function processModelRatings(data: ModelRatingsData): ProcessedRatingData {
    const pilotCertifications = processCertifications(
        data.todos_pilotos,
        data.calificaciones_modelo_pilotos
    );

    const crewCertifications = processCertifications(
        data.todas_dotaciones,
        data.calificaciones_modelo_dotaciones
    );

    return {
        pilotCertifications,
        crewCertifications,
        pilots: data.todos_pilotos.map(p => p.person_nk).filter(Boolean),
        crew: data.todas_dotaciones.map(c => c.person_nk).filter(Boolean),
        pilotRatings: data.calificaciones_modelo_pilotos,
        crewRatings: data.calificaciones_modelo_dotaciones,
        personFullNameMap: buildFullNameMap(data.todos_pilotos, data.todas_dotaciones),
        personSkMap: buildPersonSkMap(data.todos_pilotos, data.todas_dotaciones),
    };
}

/**
 * Procesa datos de General/Tactical Ratings.
 */
export function processGeneralTacticalRatings(data: GeneralTacticalRatingsData): ProcessedRatingData {
    const allPilotRatings = [
        ...data.calificaciones_generalTactica_soloPilotos,
        ...data.calificaciones_generalTactica_compartida,
    ];

    const allCrewRatings = [...data.calificaciones_generalTactica_compartida];

    // Función para extraer campos extra de estadísticas
    const extractStats = (cal: QualificationRecord): Partial<CertificationStatus> => ({
        state: cal.state,
        total_horas_VFR_diurno_365: cal.total_horas_VFR_diurno_365,
        total_horas_VFR_nocturno_365: cal.total_horas_VFR_nocturno_365,
        total_horas_GVN_90: cal.total_horas_GVN_90,
        total_horas_GVN_365: cal.total_horas_GVN_365,
        total_horas_IFR_365: cal.total_horas_IFR_365,
        total_app_precision_365: cal.total_app_precision_365,
        total_app_no_precision_365: cal.total_app_no_precision_365,
        total_tomas_dia_buque_182: cal.total_tomas_dia_buque_182,
        total_tomas_dia_mono_182: cal.total_tomas_dia_mono_182,
        total_tomas_dia_multi_182: cal.total_tomas_dia_multi_182,
        total_tomas_dia_carrier_182: cal.total_tomas_dia_carrier_182,
        total_tomas_nocheConv_buque_182: cal.total_tomas_nocheConv_buque_182,
        total_tomas_nocheConv_mono_182: cal.total_tomas_nocheConv_mono_182,
        total_tomas_nocheConv_multi_182: cal.total_tomas_nocheConv_multi_182,
        total_tomas_nocheConv_carrier_182: cal.total_tomas_nocheConv_carrier_182,
        total_tomas_GVN_buque_182: cal.total_tomas_GVN_buque_182,
        total_tomas_GVN_mono_182: cal.total_tomas_GVN_mono_182,
        total_tomas_GVN_multi_182: cal.total_tomas_GVN_multi_182,
        total_tomas_GVN_carrier_182: cal.total_tomas_GVN_carrier_182,
    });

    const pilotCertifications = processCertifications(
        data.todos_pilotos,
        allPilotRatings,
        true,
        extractStats
    );

    const crewCertifications = processCertifications(
        data.todas_dotaciones,
        allCrewRatings,
        true,
        (cal) => ({
            state: cal.state,
            total_horas_GVN_90: cal.total_horas_GVN_90,
            total_horas_GVN_365: cal.total_horas_GVN_365,
        })
    );

    return {
        pilotCertifications,
        crewCertifications,
        pilots: data.todos_pilotos.map(p => p.person_nk).filter(Boolean),
        crew: data.todas_dotaciones.map(c => c.person_nk).filter(Boolean),
        pilotRatings: allPilotRatings,
        crewRatings: allCrewRatings,
        personFullNameMap: buildFullNameMap(data.todos_pilotos, data.todas_dotaciones),
        personSkMap: buildPersonSkMap(data.todos_pilotos, data.todas_dotaciones),
    };
}

/**
 * Procesa datos de Leadership Ratings.
 */
export function processLeadershipRatings(data: LeadershipRatingsData): ProcessedRatingData {
    const pilotCertifications = processCertifications(
        data.todos_pilotos,
        data.calificaciones_mandoYliderazgo_pilotos
    );

    return {
        pilotCertifications,
        crewCertifications: {},
        pilots: data.todos_pilotos.map(p => p.person_nk).filter(Boolean),
        crew: [],
        pilotRatings: data.calificaciones_mandoYliderazgo_pilotos,
        crewRatings: [],
        personFullNameMap: buildFullNameMap(data.todos_pilotos),
        personSkMap: buildPersonSkMap(data.todos_pilotos),
    };
}

/**
 * Procesa datos de Maintenance Ratings.
 */
export function processMaintenanceRatings(data: MaintenanceRatingsData): ProcessedRatingData {
    const certifications = processNotCrewCertifications(
        data.todos_mantenedores,
        data.calificaciones_mantenimiento
    );

    // Para mantenimiento, usamos full_name como key y no tenemos person_nk
    const fullNameMap: Record<string, string> = {};
    const skMap: Record<string, number> = {};

    data.todos_mantenedores.forEach((person) => {
        fullNameMap[person.full_name] = person.full_name.trim();
        skMap[person.full_name] = person.person_sk;
    });

    // Convertir NotCrewRating a Rating para compatibilidad
    const ratings: Rating[] = data.calificaciones_mantenimiento.map((r) => ({
        crew_rating_sk: r.notCrew_rating_sk,
        name: r.notCrew_rating_name,
        abbreviation: r.notCrew_rating_abrv,
    }));

    return {
        pilotCertifications: certifications, // Usamos pilotCertifications para almacenar
        crewCertifications: {},
        pilots: data.todos_mantenedores.map(p => p.full_name).filter(Boolean),
        crew: [],
        pilotRatings: ratings,
        crewRatings: [],
        personFullNameMap: fullNameMap,
        personSkMap: skMap,
    };
}

