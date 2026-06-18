import { useState, useEffect, useTransition } from 'react';
import { useApiPaginatedQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla, PermissionLevel, useUser } from '@/providers';
import type { GroundSchoolItem } from '@/types/generated/groundschool';
import {
    ChevronLeft, ChevronRight, RefreshCw, Trash2,
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
    SearchInput,
} from '@/shared/components/common';

// Formatea "YYYY-MM-DD" → "DD/MM/YYYY" sin tocar zona horaria.
const formatFecha = (fecha: string): string => {
    const [y, m, d] = fecha.split('-');
    return y && m && d ? `${d}/${m}/${y}` : fecha;
};

const GroundSchool = () => {
    const { hasPermission } = useUser();
    const { id: escId } = useEscuadrilla();
    const [isPending, startTransition] = useTransition();
    const [searchInput, setSearchInput] = useState('');

    const [params, setParamsState] = useState({ limit: 20, offset: 0, ground_school_sk: null as number | null });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState((prev) => ({ ...prev, ...newParams }));
    };

    // Búsqueda en vivo con debounce (300ms): busca por ID al dejar de teclear
    // (1 petición por pausa, no por pulsación) y vuelve a la 1ª página.
    useEffect(() => {
        const t = setTimeout(() => {
            const sk = searchInput.trim() ? parseInt(searchInput, 10) : null;
            setParams({ ground_school_sk: sk != null && !Number.isNaN(sk) ? sk : null, offset: 0 });
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.ground_school_sk != null) query.ground_school_sk = params.ground_school_sk;

    const {
        data: items,
        totalCount,
        isLoading,
        refetch,
    } = useApiPaginatedQuery<GroundSchoolItem>({
        path: '/ground-school',
        query,
        queryKey: queryKeys.groundSchool.list(escId ?? 0, params),
    });

    const canWrite = hasPermission(PermissionLevel.OPERACIONAL);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [toDelete, setToDelete] = useState<number | null>(null);

    // Invalida todo el dominio de ground school de la escuadrilla. El error HTTP
    // lo notifica el toast de useApiMutation.
    const deleteGroundSchool = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `/ground-school/${v.id}`,
        {
            invalidateKeys: [queryKeys.groundSchool.all(escId ?? 0)],
            successMessage: 'Registro eliminado con éxito.',
        },
    );

    const itemsPerPage = params.limit;
    const currentPage = Math.floor(params.offset / itemsPerPage) + 1;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handleRefresh = () => startTransition(() => { refetch(); });

    const openDeleteDialog = (id: number) => {
        setToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (toDelete == null) return;
        try {
            await deleteGroundSchool.mutateAsync({ id: toDelete });
        } finally {
            setDeleteDialogOpen(false);
            setToDelete(null);
        }
    };

    const colSpan = canWrite ? 6 : 5;

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Ground School</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por ID..."
                            />
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <ActionButton
                                variant="refresh"
                                icon={RefreshCw}
                                label="Actualizar"
                                onClick={(e) => {
                                    handleRefresh();
                                    const icon = e.currentTarget.querySelector('svg');
                                    if (icon) {
                                        icon.classList.remove('animate-spin-once');
                                        requestAnimationFrame(() => {
                                            icon.classList.add('animate-spin-once');
                                        });
                                    }
                                }}
                                disabled={isPending}
                                loading={isPending}
                            />
                        </div>
                    </div>
                </PageControls>

                {/* Tabla */}
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[760px]" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Fecha</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Persona</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Papeleta</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Descripción</th>
                                    {canWrite && <th className="text-center p-4 font-semibold text-table-header-foreground"></th>}
                                </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr><td colSpan={colSpan} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={colSpan} className="p-8 text-center text-muted-foreground">No se encontraron registros</td></tr>
                            ) : (
                                items.map((item, idx) => (
                                    <TableRow key={item.id} index={idx}>
                                        <td className="p-4">
                                            <span className="text-sm text-muted-foreground">{item.id}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-muted-foreground">{formatFecha(item.fecha)}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-foreground">{item.persona}</span>
                                            {item.personaNk && (
                                                <span className="text-xs text-muted-foreground ml-2">{item.personaNk}</span>
                                            )}
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-foreground font-medium">{item.papeleta}</span>
                                            {item.bloque && (
                                                <div className="text-xs text-muted-foreground">{item.bloque}</div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-muted-foreground">{item.descripcion}</span>
                                        </td>
                                        {canWrite && (
                                            <td className="text-center p-4">
                                                <button
                                                    onClick={() => openDeleteDialog(item.id)}
                                                    className="text-danger hover:text-danger/80 transition-all"
                                                    aria-label="Eliminar registro"
                                                >
                                                    <Trash2 className="w-4 h-4 mx-auto" />
                                                </button>
                                            </td>
                                        )}
                                    </TableRow>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-muted/50 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} registros
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setParams({ offset: Math.max(0, params.offset - itemsPerPage) })} disabled={currentPage === 1 || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === 1 || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                                        return (
                                            <button key={pageNum} onClick={() => setParams({ offset: (pageNum - 1) * itemsPerPage })} disabled={isPending} className={`px-3 py-1 rounded-lg transition-colors ${currentPage === pageNum ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={() => setParams({ offset: Math.min((totalPages - 1) * itemsPerPage, params.offset + itemsPerPage) })} disabled={currentPage === totalPages || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === totalPages || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}
                </PageTableContainer>
            </div>

            {/* Confirmación de borrado */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">¿Eliminar registro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminará permanentemente el registro de Ground School{' '}
                            <span className="font-semibold text-foreground">ID: {toDelete}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteGroundSchool.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            disabled={deleteGroundSchool.isPending}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {deleteGroundSchool.isPending ? (
                                <span className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Eliminando...
                                </span>
                            ) : 'Continuar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default GroundSchool;
