// Query key factory for TanStack Query.
// All keys include escuadrillaId for RLS cache isolation.

export const queryKeys = {
    // ========================================================================
    // LOOKUPS (staleTime: Infinity - rarely change during session)
    // ========================================================================
    lookups: {
        all: (escuadrillaId: number) => ['lookups', escuadrillaId] as const,
        aircrafts: (escuadrillaId: number) => ['lookups', 'aircrafts', escuadrillaId] as const,
        aircraftsManage: (escuadrillaId: number) => ['lookups', 'aircraftsManage', escuadrillaId] as const,
        eventsManage: (escuadrillaId: number) => ['lookups', 'eventsManage', escuadrillaId] as const,
        departureArrivalPlaces: (escuadrillaId: number) => ['lookups', 'departureArrivalPlaces', escuadrillaId] as const,
        eventsLookup: (escuadrillaId: number) => ['lookups', 'events', escuadrillaId] as const,
        authorities: (escuadrillaId: number) => ['lookups', 'authorities', escuadrillaId] as const,
        pilots: (escuadrillaId: number) => ['lookups', 'pilots', escuadrillaId] as const,
        crew: (escuadrillaId: number) => ['lookups', 'crew', escuadrillaId] as const,
        papeletas: (escuadrillaId: number) => ['lookups', 'papeletas', escuadrillaId] as const,
        passengerTypes: (escuadrillaId: number) => ['lookups', 'passengerTypes', escuadrillaId] as const,
        comisionTypes: (escuadrillaId: number) => ['lookups', 'comisionTypes', escuadrillaId] as const,
        comisionLugares: (escuadrillaId: number) => ['lookups', 'comisionLugares', escuadrillaId] as const,
        recentComisiones: (escuadrillaId: number) => ['lookups', 'recentComisiones', escuadrillaId] as const,
        personsForComision: (escuadrillaId: number) => ['lookups', 'personsForComision', escuadrillaId] as const,
        eventNames: (escuadrillaId: number) => ['lookups', 'eventNames', escuadrillaId] as const,
        papeletaBloques: (escuadrillaId: number) => ['lookups', 'papeletaBloques', escuadrillaId] as const,
        papeletaPlanes: (escuadrillaId: number) => ['lookups', 'papeletaPlanes', escuadrillaId] as const,
        personEspecialidades: (escuadrillaId: number) => ['lookups', 'personEspecialidades', escuadrillaId] as const,
        personEmpleos: (escuadrillaId: number) => ['lookups', 'personEmpleos', escuadrillaId] as const,
        personDivisiones: (escuadrillaId: number) => ['lookups', 'personDivisiones', escuadrillaId] as const,
        personRoles: (escuadrillaId: number) => ['lookups', 'personRoles', escuadrillaId] as const,
        persons: (escuadrillaId: number) => ['lookups', 'persons', escuadrillaId] as const,
    },

    // ========================================================================
    // FEATURE DATA
    // ========================================================================
    flights: {
        all: (escuadrillaId: number) => ['flights', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['flights', 'list', escuadrillaId, params] as const,
    },

    personnel: {
        all: (escuadrillaId: number) => ['personnel', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['personnel', 'list', escuadrillaId, params] as const,
    },

    events: {
        all: (escuadrillaId: number) => ['events', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['events', 'list', escuadrillaId, params] as const,
    },

    papeletas: {
        all: (escuadrillaId: number) => ['papeletas', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['papeletas', 'list', escuadrillaId, params] as const,
    },

    comisiones: {
        all: (escuadrillaId: number) => ['comisiones', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['comisiones', 'list', escuadrillaId, params] as const,
        dias: {
            all: (escuadrillaId: number) => ['comisiones', 'dias', escuadrillaId] as const,
            list: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['comisiones', 'dias', 'list', escuadrillaId, params] as const,
        },
    },

    dashboard: {
        static: (escuadrillaId: number) => ['dashboard', 'static', escuadrillaId] as const,
        dynamic: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['dashboard', 'dynamic', escuadrillaId, params] as const,
    },

    availability: {
        all: (escuadrillaId: number) => ['availability', escuadrillaId] as const,
        calendar: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['availability', 'calendar', escuadrillaId, params] as const,
        festivos: (escuadrillaId: number) => ['availability', 'festivos', escuadrillaId] as const,
    },

    hours: {
        all: (escuadrillaId: number) => ['hours', escuadrillaId] as const,
        pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', 'pilotos', escuadrillaId, params] as const,
        landings: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['hours', 'landings', escuadrillaId, params] as const,
    },

    ratings: {
        all: (escuadrillaId: number) => ['ratings', escuadrillaId] as const,
        model: (escuadrillaId: number) => ['ratings', 'model', escuadrillaId] as const,
        operational: (escuadrillaId: number) => ['ratings', 'operational', escuadrillaId] as const,
        generalTactical: (escuadrillaId: number) => ['ratings', 'generalTactical', escuadrillaId] as const,
        leadership: (escuadrillaId: number) => ['ratings', 'leadership', escuadrillaId] as const,
        maintenance: (escuadrillaId: number) => ['ratings', 'maintenance', escuadrillaId] as const,
    },

    training: {
        all: (escuadrillaId: number) => ['training', escuadrillaId] as const,
        adiestramiento: {
            pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', 'adiestramiento', 'pilotos', escuadrillaId, params] as const,
            dotaciones: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', 'adiestramiento', 'dotaciones', escuadrillaId, params] as const,
        },
        instruccion: {
            pilotos: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', 'instruccion', 'pilotos', escuadrillaId, params] as const,
            dotaciones: (escuadrillaId: number, params: Record<string, unknown>) =>
                ['training', 'instruccion', 'dotaciones', escuadrillaId, params] as const,
        },
    },

    effort: {
        all: (escuadrillaId: number) => ['effort', escuadrillaId] as const,
        list: (escuadrillaId: number, params: Record<string, unknown>) =>
            ['effort', 'list', escuadrillaId, params] as const,
    },

    // Superusuario: acotado a la escuadrilla (god-mode solo en nivel de permiso).
    superuser: {
        persons: (escuadrillaId: number) => ['superuser', 'persons', escuadrillaId] as const,
    },
} as const;
