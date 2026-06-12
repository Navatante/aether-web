// src/features/ratings/index.ts
//
// Barrel export para el feature de ratings.

// Pages
export { default as ModelRatings } from './pages/ModelRatings';
export { default as OperationalRatings } from './pages/OperationalRatings';
export { default as GeneralTacticalRatings } from './pages/GeneralTacticalRatings';
export { default as LeadershipRatings } from './pages/LeadershipRatings';
export { default as MaintenanceRatings } from './pages/MaintenanceRatings';

// Types
export type {
    CertificationStatus,
    Certification,
    CertificationData,
    Rating,
    NotCrewRating,
    QualificationRecord,
    NotCrewQualificationRecord,
    PersonWithRatings,
    PersonWithNotCrewRatings,
    ModelRatingsData,
    GeneralTacticalRatingsData,
    LeadershipRatingsData,
    MaintenanceRatingsData,
    ViewMode,
    DeleteTarget,
    RatingPageConfig,
    ProcessedRatingData,
    UseRatingsReturn,
} from './types';

// Utils
export * from './utils';

// Components
export * from './components';
