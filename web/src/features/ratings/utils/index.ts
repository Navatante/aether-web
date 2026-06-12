// src/features/ratings/utils/index.ts
//
// Barrel export para utilidades de ratings.

// Colors
export {
    COLOR_PALETTE,
    MODEL_RATINGS_COLORS,
    GENERAL_TACTICAL_COLORS,
    LEADERSHIP_COLORS,
    MAINTENANCE_COLORS,
    OPERATIONAL_STATUS_COLORS,
    getRatingColorClasses,
    getRatingColorName,
    getCertificationButtonClasses,
    getStateBadgeClasses,
} from './colors';
export type { ColorName } from './colors';

// Processing functions
export {
    processCertifications,
    processNotCrewCertifications,
    buildFullNameMap,
    buildPersonSkMap,
    processModelRatings,
    processGeneralTacticalRatings,
    processLeadershipRatings,
    processMaintenanceRatings,
} from './processing';

// Hooks
export { formatLocalDate } from './hooks';
