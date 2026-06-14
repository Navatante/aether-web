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
