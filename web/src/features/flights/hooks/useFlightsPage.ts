// Estado, datos y handlers de la página de Vuelos. La página queda solo con el
// render (tabla + paginación + panel de detalle).

import React, { useEffect, useState, useTransition } from 'react';
import { useApiPaginatedQuery, useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { transformFlightsFromDB } from "../utils/transformFlightsFromDB";
import type { FlightData } from "@/types/flights";
import type { FlightItem } from "@/types/generated/flights";
import { PermissionLevel, useUser } from "@/providers";
import { useDebouncedValue } from "@/shared/hooks";

interface DeleteActionState {
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: string;
    deletedId?: number;
}

export function useFlightsPage() {
    const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);
    const [activeTab, setActiveTab] = useState('tripulacion');
    const [confirmationText, setConfirmationText] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [flightToDelete, setFlightToDelete] = useState<number | null>(null);
    const { hasPermission, escuadrillaId } = useUser();
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery, 300);

    // Params de paginación.
    const [params, setParamsState] = useState({ limit: 20, offset: 0, flight_sk: null as number | null });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState(prev => ({ ...prev, ...newParams }));
    };

    // Búsqueda en vivo (300ms): al dejar de teclear busca por ID y vuelve a la
    // 1ª página. El debounce lo encapsula useDebouncedValue.
    useEffect(() => {
        const sk = debouncedSearch.trim() ? parseInt(debouncedSearch, 10) : null;
        setParams({ flight_sk: sk != null && !Number.isNaN(sk) ? sk : null, offset: 0 });
    }, [debouncedSearch]);

    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.flight_sk != null) query.flight_sk = params.flight_sk;

    const { data: flights, totalCount, isLoading, refetch } = useApiPaginatedQuery<FlightData, FlightItem>({
        path: "/flights",
        query,
        queryKey: queryKeys.flights.list(escuadrillaId ?? 0, params),
        transform: transformFlightsFromDB,
    });

    const itemsPerPage = params.limit;
    const currentPage = Math.floor(params.offset / itemsPerPage) + 1;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    // Invalida todo el dominio de vuelos de la escuadrilla (cualquier lista, sin
    // depender de los params). El error HTTP lo notifica el toast de useApiMutation.
    const deleteFlight = useApiMutation<void, { flightId: number }>(
        'DELETE', (v) => `/flights/${v.flightId}`,
        {
            invalidateKeys: [queryKeys.flights.all(escuadrillaId ?? 0)],
            successMessage: "Vuelo eliminado con éxito.",
        },
    );

    const [, deleteAction, isDeleting] = React.useActionState<DeleteActionState, number>(
        async (_prev, flightId) => {
            try {
                await deleteFlight.mutateAsync({ flightId });
                if (selectedFlight?.id === flightId) setSelectedFlight(null);
                setConfirmationText('');
                setDeleteDialogOpen(false);
                setFlightToDelete(null);
                return { status: 'success', deletedId: flightId };
            } catch (error) {
                // El error HTTP ya lo notifica el toast de useApiMutation.
                return { status: 'error', error: error instanceof Error ? error.message : 'Error' };
            }
        },
        { status: 'idle' }
    );

    const handleRowClick = (flight: FlightData) => {
        setSelectedFlight(selectedFlight?.id === flight.id ? null : flight);
        setActiveTab('tripulacion');
    };

    const handleRefresh = () => startTransition(() => { refetch(); });

    const openDeleteDialog = (flightId: number) => {
        setFlightToDelete(flightId);
        setConfirmationText('');
        setDeleteDialogOpen(true);
    };

    return {
        // Datos
        flights,
        totalCount,
        isLoading,
        // Selección / detalle
        selectedFlight,
        handleRowClick,
        activeTab,
        setActiveTab,
        // Permisos
        canDeleteFlights: hasPermission(PermissionLevel.OPERACIONAL),
        // Borrado
        deleteDialogOpen,
        setDeleteDialogOpen,
        confirmationText,
        setConfirmationText,
        flightToDelete,
        openDeleteDialog,
        deleteAction,
        isDeleting,
        // Búsqueda
        searchQuery,
        setSearchQuery,
        // Paginación
        params,
        setParams,
        itemsPerPage,
        currentPage,
        totalPages,
        // Refresco
        isPending,
        handleRefresh,
    };
}
