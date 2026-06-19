// Query key factory for TanStack Query.
//
// Convención de forma: SIEMPRE `[dominio, escuadrillaId, ...subruta, params?]`.
// El `escuadrillaId` va en la posición 1 (justo tras el dominio) a propósito:
// así `<dominio>.all(escId)` = `[dominio, escId]` es PREFIJO de cualquier clave
// del dominio (`.list`, `.dias.list`, lookups concretos, …) y una sola
// `invalidateQueries({ queryKey: <dominio>.all(escId) })` invalida todo el
// dominio para esa escuadrilla. `useApiQuery`/`useApiPaginatedQuery` anexan al
// final `method/path/query/body`, así que la clave del factory sigue siendo
// prefijo y la invalidación por prefijo casa igual. La inclusión del escuadrillaId
// aísla la caché de forma coherente con la RLS del backend.

export const queryKeys = {
    // ========================================================================
    // LOOKUPS (staleTime: Infinity - rarely change during session)
    // ========================================================================
    lookups: {
        all: (escuadrillaId: number) => ['lookups', escuadrillaId] as const,
        aircrafts: (escuadrillaId: number) => ['lookups', escuadrillaId, 'aircrafts'] as const,
        aircraftsManage: (escuadrillaId: number) => ['lookups', escuadrillaId, 'aircraftsManage'] as const,
        aircraftModels: (escuadrillaId: number) => ['lookups', escuadrillaId, 'aircraftModels'] as const,
        eventsManage: (escuadrillaId: number) => ['lookups', escuadrillaId, 'eventsManage'] as const,
        departureArrivalPlaces: (escuadrillaId: number) => ['lookups', escuadrillaId, 'departureArrivalPlaces'] as const,
        eventsLookup: (escuadrillaId: number) => ['lookups', escuadrillaId, 'events'] as const,
        authorities: (escuadrillaId: number) => ['lookups', escuadrillaId, 'authorities'] as const,
        capbas: (escuadrillaId: number) => ['lookups', escuadrillaId, 'capbas'] as const,
        pilots: (escuadrillaId: number) => ['lookups', escuadrillaId, 'pilots'] as const,
        crew: (escuadrillaId: number) => ['lookups', escuadrillaId, 'crew'] as const,
        papeletas: (escuadrillaId: number) => ['lookups', escuadrillaId, 'papeletas'] as const,
        groundSchoolPapeletas: (escuadrillaId: number) => ['lookups', escuadrillaId, 'groundSchoolPapeletas'] as const,
        passengerTypes: (escuadrillaId: number) => ['lookups', escuadrillaId, 'passengerTypes'] as const,
        comisionTypes: (escuadrillaId: number) => ['lookups', escuadrillaId, 'comisionTypes'] as const,
        comisionLugares: (escuadrillaId: number) => ['lookups', escuadrillaId, 'comisionLugares'] as const,
        recentComisiones: (escuadrillaId: number) => ['lookups', escuadrillaId, 'recentComisiones'] as const,
        personsForComision: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personsForComision'] as const,
        eventNames: (escuadrillaId: number) => ['lookups', escuadrillaId, 'eventNames'] as const,
        papeletaBloques: (escuadrillaId: number) => ['lookups', escuadrillaId, 'papeletaBloques'] as const,
        papeletaPlanes: (escuadrillaId: number) => ['lookups', escuadrillaId, 'papeletaPlanes'] as const,
        personEspecialidades: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personEspecialidades'] as const,
        personEmpleos: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personEmpleos'] as const,
        personDivisiones: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personDivisiones'] as const,
        personRoles: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personRoles'] as const,
        persons: (escuadrillaId: number) => ['lookups', escuadrillaId, 'persons'] as const,
        personsNk: (escuadrillaId: number) => ['lookups', escuadrillaId, 'personsNk'] as const,
    },

    // ========================================================================
    // FEATURE DATA
    // ========================================================================
    flights: {
        all: (escuadrillaId: number) => ['flights', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['flights', escuadrillaId, 'list', params] as const,
        crewBySks: (escuadrillaId: number, sks: string) =>
            ['flights', escuadrillaId, 'crewBySks', sks] as const,
    },

    groundSchool: {
        all: (escuadrillaId: number) => ['groundSchool', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['groundSchool', escuadrillaId, 'list', params] as const,
    },

    extraHoursOtrosModelos: {
        all: (escuadrillaId: number) => ['extraHoursOtrosModelos', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['extraHoursOtrosModelos', escuadrillaId, 'list', params] as const,
        byPerson: (escuadrillaId: number, personSk: number) =>
            ['extraHoursOtrosModelos', escuadrillaId, 'byPerson', personSk] as const,
    },

    extraModelHours: {
        all: (escuadrillaId: number) => ['extraModelHours', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['extraModelHours', escuadrillaId, 'list', params] as const,
        byPerson: (escuadrillaId: number, personSk: number) =>
            ['extraModelHours', escuadrillaId, 'byPerson', personSk] as const,
    },

    personnel: {
        all: (escuadrillaId: number) => ['personnel', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['personnel', escuadrillaId, 'list', params] as const,
    },

    events: {
        all: (escuadrillaId: number) => ['events', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['events', escuadrillaId, 'list', params] as const,
    },

    papeletas: {
        all: (escuadrillaId: number) => ['papeletas', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['papeletas', escuadrillaId, 'list', params] as const,
    },

    comisiones: {
        all: (escuadrillaId: number) => ['comisiones', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['comisiones', escuadrillaId, 'list', params] as const,
        dias: {
            all: (escuadrillaId: number) => ['comisiones', escuadrillaId, 'dias'] as const,
            list: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['comisiones', escuadrillaId, 'dias', 'list', params] as const,
        },
    },

    dashboard: {
        static: (escuadrillaId: number) => ['dashboard', escuadrillaId, 'static'] as const,
        dynamic: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['dashboard', escuadrillaId, 'dynamic', params] as const,
    },

    availability: {
        all: (escuadrillaId: number) => ['availability', escuadrillaId] as const,
        calendar: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['availability', escuadrillaId, 'calendar', params] as const,
        festivos: (escuadrillaId: number) => ['availability', escuadrillaId, 'festivos'] as const,
    },

    hours: {
        all: (escuadrillaId: number) => ['hours', escuadrillaId] as const,
        pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'pilotos', params] as const,
        formacion: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'formacion', params] as const,
        gvntype: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'gvntype', params] as const,
        ift: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'ift', params] as const,
        instructor: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'instructor', params] as const,
        cta: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'cta', params] as const,
        wt: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'wt', params] as const,
        landings: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'landings', params] as const,
        projectiles: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', escuadrillaId, 'projectiles', params] as const,
    },

    ratings: {
        all: (escuadrillaId: number) => ['ratings', escuadrillaId] as const,
        model: (escuadrillaId: number) => ['ratings', escuadrillaId, 'model'] as const,
        operational: (escuadrillaId: number) => ['ratings', escuadrillaId, 'operational'] as const,
        generalTactical: (escuadrillaId: number) => ['ratings', escuadrillaId, 'generalTactical'] as const,
        leadership: (escuadrillaId: number) => ['ratings', escuadrillaId, 'leadership'] as const,
        maintenance: (escuadrillaId: number) => ['ratings', escuadrillaId, 'maintenance'] as const,
    },

    training: {
        all: (escuadrillaId: number) => ['training', escuadrillaId] as const,
        adiestramiento: {
            pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', escuadrillaId, 'adiestramiento', 'pilotos', params] as const,
            dotaciones: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', escuadrillaId, 'adiestramiento', 'dotaciones', params] as const,
        },
        instruccion: {
            pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', escuadrillaId, 'instruccion', 'pilotos', params] as const,
            dotaciones: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', escuadrillaId, 'instruccion', 'dotaciones', params] as const,
        },
    },

    effort: {
        all: (escuadrillaId: number) => ['effort', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['effort', escuadrillaId, 'list', params] as const,
    },

    // Superusuario: acotado a la escuadrilla (god-mode solo en nivel de permiso).
    superuser: {
        all: (escuadrillaId: number) => ['superuser', escuadrillaId] as const,
        persons: (escuadrillaId: number) => ['superuser', escuadrillaId, 'persons'] as const,
    },
} as const;
