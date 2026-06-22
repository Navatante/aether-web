// shared/hooks/useLookups.ts
//
// Hooks para obtener datos de referencia (lookups) desde el backend Go.
// Cada lookup pega contra GET /api/v1/lookups/:name. RLS por escuadrilla
// la aplica el backend a partir de la cookie de sesión.

import { useLookupQuery } from '@/lib/apiQuery';
import { useEscuadrilla } from '@/providers';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// TYPES
// ============================================================================

export interface AircraftLookup {
    aircraft_sk: number;
    aircraft_number: string;
}

export interface AircraftModelLookup {
    aircraft_model_sk: number;
    aircraft_type: string;
    aircraft_make: string;
    aircraft_model: string;
    aircraft_variant: string;
    aircraft_is_multi_engine: boolean;
    aircraft_is_multi_pilot: boolean;
}

export interface AircraftManageLookup {
    aircraft_sk: number;
    aircraft_registration: string;
    aircraft_number: string;
    aircraft_current_flag: boolean;
    aircraft_type: string;
    aircraft_make: string;
    aircraft_model: string;
    aircraft_variant: string;
    aircraft_is_multi_engine: boolean;
    aircraft_is_multi_pilot: boolean;
}

export interface EventManageLookup {
    event_sk: number;
    event_name: string;
    event_place: string;
}

export interface DepartureArrivalPlaceLookup {
    departure_arrival_place_sk: number;
    departure_arrival_place_code: string;
    departure_arrival_place_name: string;
}

export interface EventLookup {
    event_sk: number;
    event: string;
}

export interface AuthorityLookup {
    authority_sk: number;
    authority_name: string;
}

export interface CapbaLookup {
    capba_id: number;
    capba_name: string;
}

export interface CrewLookup {
    person_sk: number;
    person_nk: string;
}

export interface PapeletaLookup {
    papeleta_sk: number;
    papeleta_name: string;
}

export interface PassengerTypeLookup {
    passenger_type_sk: number;
    passenger_type_name: string;
}

export interface ComisionTypeLookup {
    comision_type_sk: number;
    name: string;
    origin: string;
}

export interface ComisionLugarLookup {
    comision_lugar_sk: number;
    comision_name: string;
}

export interface RecentComisionLookup {
    comision_sk: number;
    lugar: string | null;
    tipo: string | null;
    fechaInicio: string | null;
    fechaFin: string | null;
    esfuerzo: string | null;
}

export interface PersonForComisionLookup {
    person_sk: number;
    person_rank: string | null;
    person_name: string;
    person_last_name_1: string;
    person_last_name_2: string | null;
}

export interface PersonLookup {
    person_sk: number;
    full_name: string;
}

export interface FuelPlaceLookup {
    fuel_place_sk: number;
    fuel_place_name: string;
    fuel_place_type: string;
}

export interface FuelPayerLookup {
    fuel_payer_sk: number;
    fuel_payer_abbrev: string;
    fuel_payer_type: string;
    fuel_payer_name: string;
}

export interface FuelPhaseLookup {
    fuel_phase_sk: number;
    fuel_phase: string;
}

export interface FuelTypeLookup {
    fuel_type_sk: number;
    fuel_type: string;
}

// ============================================================================
// GENERIC LOOKUP ADAPTER
// ============================================================================

interface UseLookupReturn<T> {
    data: T[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<unknown>;
}

/**
 * Internal adapter: `name` es el path del lookup contra GET /lookups/:name.
 * El queryKey siempre depende de la escuadrilla activa para aislar cachés.
 */
function useLookup<T>(
    name: string,
    queryKeyFn: (escuadrillaId: number) => readonly unknown[],
): UseLookupReturn<T> {
    const { id: escuadrillaId } = useEscuadrilla();
    const { data, isLoading, error, refetch } = useLookupQuery<T[]>(name, queryKeyFn(escuadrillaId ?? 0));

    return {
        data: data ?? [],
        loading: isLoading,
        error: error?.message ?? null,
        refetch,
    };
}

// ============================================================================
// FLIGHT FORM LOOKUPS
// ============================================================================

/** Obtiene lista de aeronaves para selector */
export function useAircrafts() {
    return useLookup<AircraftLookup>('aircrafts', queryKeys.lookups.aircrafts);
}

/** Obtiene lista completa de aeronaves para gestión (matrícula, número, estado) */
export function useAircraftsManage() {
    return useLookup<AircraftManageLookup>('aircrafts-manage', queryKeys.lookups.aircraftsManage);
}

/** Catálogo global de modelos de aeronave (selector del diálogo de aeronaves) */
export function useAircraftModels() {
    return useLookup<AircraftModelLookup>('aircraft-models', queryKeys.lookups.aircraftModels);
}

/** Obtiene lista completa de eventos para gestión (nombre y lugar separados) */
export function useEventsManage() {
    return useLookup<EventManageLookup>('events-manage', queryKeys.lookups.eventsManage);
}

/** Obtiene lista de lugares de salida/llegada para selector */
export function useDepartureArrivalPlaces() {
    return useLookup<DepartureArrivalPlaceLookup>('departure-arrival-places', queryKeys.lookups.departureArrivalPlaces);
}

/** Obtiene lista de eventos para selector */
export function useEventsLookup() {
    return useLookup<EventLookup>('events', queryKeys.lookups.eventsLookup);
}

/** Catálogo de lugares de repostaje (selector del diálogo de combustible) */
export function useFuelPlaces() {
    return useLookup<FuelPlaceLookup>('fuel-places', queryKeys.lookups.fuelPlaces);
}

/** Catálogo de pagadores de combustible */
export function useFuelPayers() {
    return useLookup<FuelPayerLookup>('fuel-payers', queryKeys.lookups.fuelPayers);
}

/** Catálogo de fases de combustible (Preparación / Ejecución) */
export function useFuelPhases() {
    return useLookup<FuelPhaseLookup>('fuel-phases', queryKeys.lookups.fuelPhases);
}

/** Catálogo de tipos de combustible (Jet A-1, JP-5, …) */
export function useFuelTypes() {
    return useLookup<FuelTypeLookup>('fuel-types', queryKeys.lookups.fuelTypes);
}

/** Obtiene lista de autoridades para selector */
export function useAuthorities() {
    return useLookup<AuthorityLookup>('authorities', queryKeys.lookups.authorities);
}

/** Obtiene lista de capacidades básicas de la escuadrilla para selector */
export function useCapbas() {
    return useLookup<CapbaLookup>('capbas', queryKeys.lookups.capbas);
}

/** Obtiene lista de pilotos para selector */
export function usePilotsLookup() {
    return useLookup<CrewLookup>('pilots', queryKeys.lookups.pilots);
}

/** Obtiene lista de dotación (no pilotos) para selector */
export function useCrewLookup() {
    return useLookup<CrewLookup>('crew', queryKeys.lookups.crew);
}

/** Obtiene lista de papeletas para selector */
export function usePapeletasLookup() {
    return useLookup<PapeletaLookup>('papeletas', queryKeys.lookups.papeletas);
}

/** Papeletas para Ground School (excluye bloques 'Simulador' y 'Vuelo') */
export function useGroundSchoolPapeletasLookup() {
    return useLookup<PapeletaLookup>('ground-school-papeletas', queryKeys.lookups.groundSchoolPapeletas);
}

/** Obtiene lista de tipos de pasajero para selector */
export function usePassengerTypes() {
    return useLookup<PassengerTypeLookup>('passenger-types', queryKeys.lookups.passengerTypes);
}

// ============================================================================
// COMISION FORM LOOKUPS
// ============================================================================

/** Obtiene lista de tipos de comisión para selector */
export function useComisionTypes() {
    return useLookup<ComisionTypeLookup>('comision-types', queryKeys.lookups.comisionTypes);
}

/** Obtiene lista de lugares de comisión para selector */
export function useComisionLugares() {
    return useLookup<ComisionLugarLookup>('comision-lugares', queryKeys.lookups.comisionLugares);
}

/** Obtiene las comisiones más recientes para selector */
export function useRecentComisiones() {
    return useLookup<RecentComisionLookup>('recent-comisiones', queryKeys.lookups.recentComisiones);
}

/** Obtiene lista de personas para asignar a comisión */
export function usePersonsForComision() {
    return useLookup<PersonForComisionLookup>('persons-for-comision', queryKeys.lookups.personsForComision);
}

// ============================================================================
// EVENT FORM LOOKUPS
// ============================================================================

/** Obtiene lista de nombres de evento únicos para selector */
export function useEventNamesLookup() {
    return useLookup<string>('event-names', queryKeys.lookups.eventNames);
}

// ============================================================================
// PAPELETA FORM LOOKUPS
// ============================================================================

/** Obtiene lista de bloques de papeleta únicos para selector */
export function usePapeletaBloquesLookup() {
    return useLookup<string>('papeleta-bloques', queryKeys.lookups.papeletaBloques);
}

/** Obtiene lista de planes de papeleta únicos para selector */
export function usePapeletaPlanesLookup() {
    return useLookup<string>('papeleta-planes', queryKeys.lookups.papeletaPlanes);
}

// ============================================================================
// PERSON FORM LOOKUPS
// ============================================================================

/** Obtiene lista de especialidades de persona únicas para selector */
export function usePersonEspecialidadesLookup() {
    return useLookup<string>('person-especialidades', queryKeys.lookups.personEspecialidades);
}

/** Obtiene lista de empleos (rangos) de persona únicos para selector */
export function usePersonEmpleosLookup() {
    return useLookup<string>('person-empleos', queryKeys.lookups.personEmpleos);
}

/** Obtiene lista de divisiones de persona únicas para selector */
export function usePersonDivisionesLookup() {
    return useLookup<string>('person-divisiones', queryKeys.lookups.personDivisiones);
}

/** Obtiene lista de roles de persona únicos para selector */
export function usePersonRolesLookup() {
    return useLookup<string>('person-roles', queryKeys.lookups.personRoles);
}

// ============================================================================
// AVAILABILITY/ABSENCE FORM LOOKUPS
// ============================================================================

/** Obtiene lista de personas para selector de ausencias */
export function usePersonsLookup() {
    return useLookup<PersonLookup>('persons', queryKeys.lookups.persons);
}

/** Personas activas con su person_nk (selectores que muestran el NK) */
export function usePersonsNkLookup() {
    return useLookup<CrewLookup>('persons-nk', queryKeys.lookups.personsNk);
}
