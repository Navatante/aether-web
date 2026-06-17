// Tipos de horas de vuelo por periodo. La forma de la API viene GENERADA desde
// los structs Go (web/src/types/generated/hours.ts, regenerar con `make types`).
// Aquí solo se re-exportan con los nombres históricos del frontend.

export type {
    Tripulante as TripulanteData,
    Result as TripulantesResponse,
} from './generated/hours';

// Dato enriquecido en cliente con el total de los tres periodos (Día+Noche+GVN).
import type { Tripulante } from './generated/hours';

export interface EnrichedTripulanteData extends Tripulante {
    total_all: number;
}

// Horas de vuelo en formación (operations.formation_hour): Día y GVN por persona.
export type {
    FormationTripulante as FormationTripulanteData,
    FormationResult as FormationResponse,
} from './generated/hours';

// Horas por tipo de GVN (operations.gvntype_hour): IIT y ANVIS por persona.
export type {
    GvntypeTripulante as GvntypeTripulanteData,
    GvntypeResult as GvntypeResponse,
} from './generated/hours';

// Horas por instrumentos (operations.ift_hour) por persona.
export type {
    IftTripulante as IftTripulanteData,
    IftResult as IftResponse,
} from './generated/hours';

// Horas como instructor (operations.instructor_hour) por persona.
export type {
    InstructorTripulante as InstructorTripulanteData,
    InstructorResult as InstructorResponse,
} from './generated/hours';

// Horas como Comandante de Aeronave (CTA) por persona.
export type {
    CtaTripulante as CtaTripulanteData,
    CtaResult as CtaResponse,
} from './generated/hours';

// Horas en Winch Trim (operations.wt_hour) por persona (Dotaciones).
export type {
    WtTripulante as WtTripulanteData,
    WtResult as WtResponse,
} from './generated/hours';
