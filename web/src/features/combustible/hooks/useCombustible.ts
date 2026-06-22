// Estado, datos y handlers de la página de Combustible. La página queda solo
// con el render (selector mes/año + buscador por ID + resumen + tabla).

import { useEffect, useState, useTransition } from 'react';
import { useApiPaginatedQuery, useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { PermissionLevel, useUser, useEscuadrilla } from '@/providers';
import { useDebouncedValue } from '@/shared/hooks';
import type { FuelItem, FuelSummary } from '@/types/generated/fuel';
import { MONTHS_ES } from '../fuel';

const ITEMS_PER_PAGE = 25;
const EMPTY_SUMMARY: FuelSummary = { payers: [], grand_total: 0 };

export function useCombustible() {
    const { id: escId } = useEscuadrilla();
    const { hasPermission } = useUser();
    const canWrite = hasPermission(PermissionLevel.OPERACIONAL);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
    const [year, setYear] = useState(now.getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [offset, setOffset] = useState(0);
    const [editing, setEditing] = useState<FuelItem | null>(null);
    const [isPending, startTransition] = useTransition();

    // Búsqueda por ID (debounce 300ms). Al teclear vuelve a la 1ª página.
    const debouncedSearch = useDebouncedValue(searchQuery, 300);
    useEffect(() => { setOffset(0); }, [debouncedSearch, month, year]);
    const fuelSk = debouncedSearch.trim() ? parseInt(debouncedSearch, 10) : null;
    const searchSk = fuelSk != null && !Number.isNaN(fuelSk) ? fuelSk : 0;

    // Lista: si se busca por ID, el backend ignora el mes (búsqueda global).
    const listQuery: Record<string, string | number> = { month, year, limit: ITEMS_PER_PAGE, offset };
    if (searchSk > 0) listQuery.fuel_sk = searchSk;
    const {
        data: items, totalCount, isLoading, refetch,
    } = useApiPaginatedQuery<FuelItem>({
        path: '/fuel',
        query: listQuery,
        queryKey: queryKeys.fuel.list(escId ?? 0, listQuery),
    });

    // Resumen del mes (no se ve afectado por la búsqueda por ID).
    const summaryQuery = { month, year };
    const {
        data: summary, isFetching: summaryLoading,
    } = useApiQuery<FuelSummary>(
        'GET', '/fuel/summary', { query: summaryQuery }, queryKeys.fuel.summary(escId ?? 0, summaryQuery),
    );

    const deleteFuel = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `/fuel/${v.id}`,
        {
            invalidateKeys: [queryKeys.fuel.all(escId ?? 0)],
            successMessage: 'Repostaje eliminado con éxito.',
        },
    );

    const handleDelete = (id: number) => { deleteFuel.mutate({ id }); };
    const handleRefresh = () => startTransition(() => { refetch(); });

    const currentPage = Math.floor(offset / ITEMS_PER_PAGE) + 1;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    const goToPage = (page: number) => setOffset((page - 1) * ITEMS_PER_PAGE);
    const periodLabel = `${MONTHS_ES[month - 1]} ${year}`;

    return {
        // datos
        items,
        totalCount,
        isLoading,
        summary: summary ?? EMPTY_SUMMARY,
        summaryLoading,
        periodLabel,
        // permisos
        canWrite,
        // selector mes/año
        month, setMonth, year, setYear,
        // búsqueda por ID
        searchQuery, setSearchQuery,
        // edición / borrado
        editing, setEditing, handleDelete, isDeleting: deleteFuel.isPending,
        // refresco
        isPending, handleRefresh,
        // paginación
        itemsPerPage: ITEMS_PER_PAGE,
        currentPage, totalPages, goToPage,
    };
}
