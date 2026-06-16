// Shared hooks barrel export
export { useConfirmationDialog } from './useConfirmationDialog'
export type { ConfirmationTarget } from './useConfirmationDialog'

// Lookups (datos de referencia para formularios)
export {
    useAircrafts,
    useAircraftsManage,
    useEventsManage,
    useDepartureArrivalPlaces,
    useEventsLookup,
    useAuthorities,
    useCapbas,
    usePilotsLookup,
    useCrewLookup,
    usePapeletasLookup,
    usePassengerTypes,
    useComisionTypes,
    useComisionLugares,
    useRecentComisiones,
    usePersonsForComision,
    useEventNamesLookup,
    usePapeletaBloquesLookup,
    usePapeletaPlanesLookup,
    usePersonEspecialidadesLookup,
    usePersonEmpleosLookup,
    usePersonDivisionesLookup,
    usePersonRolesLookup,
    usePersonsLookup,
} from './useLookups'
export type {
    AircraftLookup,
    AircraftManageLookup,
    EventManageLookup,
    DepartureArrivalPlaceLookup,
    EventLookup,
    AuthorityLookup,
    CapbaLookup,
    CrewLookup,
    PapeletaLookup,
    PassengerTypeLookup,
    ComisionTypeLookup,
    ComisionLugarLookup,
    RecentComisionLookup,
    PersonForComisionLookup,
    PersonLookup,
} from './useLookups'
