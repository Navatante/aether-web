/**
 * Persona participante en una comisión
 */
export interface PersonaParticipante {
    person_comision_sk: number;
    nombre: string;
    orden: number;
}

/**
 * Datos principales de una comisión (coincide con la salida del SP)
 */
export interface ComisionData {
    comision_sk: number;
    fecha_inicio: string;
    fecha_fin: string;
    dias: number;
    lugar: string;
    tipo: string;
    esfuerzo: boolean;
    personas_participantes: PersonaParticipante[];
}