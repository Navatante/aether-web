// Tipos de comisiones. La forma de la API viene GENERADA desde los structs
// Go (web/src/types/generated/comisiones.ts, regenerar con `make types`).
// Aquí solo se re-exportan con los nombres históricos del frontend.

export type {
    ComisionParticipante as PersonaParticipante,
    ComisionListItem as ComisionData,
} from './generated/comisiones';
