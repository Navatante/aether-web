import React, { useState, useEffect, useTransition } from 'react';
import { useApiPaginatedQuery, useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla, PermissionLevel, useUser } from '@/providers';
import type { PersonTotalsItem, ExtraHourItem } from '@/types/generated/extrahours';
import {
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw, Trash2, Pencil,
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
    DetailsRow,
    SearchInput,
} from '@/shared/components/common';
import { RegisterExtraHoursOtrosModelosDialog } from '../components';

// Formatea horas (1 decimal). 0 → "—" para aligerar la tabla.
const fmtHours = (h: number): string => (h ? h.toFixed(1) : '—');

const HorasExtraOtrosModelos = () => {
    const { hasPermission } = useUser();
    const { id: escId } = useEscuadrilla();
    const [isPending, startTransition] = useTransition();
    const [searchInput, setSearchInput] = useState('');

    const [params, setParamsState] = useState({ limit: 20, offset: 0, q: '' });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState((prev) => ({ ...prev, ...newParams }));
    };

    // Búsqueda en vivo con debounce: relanza el filtro 300ms después de dejar de
    // teclear (1 petición por pausa, no por pulsación) y vuelve a la 1ª página.
    useEffect(() => {
        const t = setTimeout(() => {
            setParamsState((prev) => ({ ...prev, q: searchInput.trim(), offset: 0 }));
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.q) query.q = params.q;

    const {
        data: persons,
        totalCount,
        isLoading,
        refetch,
    } = useApiPaginatedQuery<PersonTotalsItem>({
        path: '/extra-hours',
        query,
        queryKey: queryKeys.extraHoursOtrosModelos.list(escId ?? 0, params),
    });

    const canWrite = hasPermission(PermissionLevel.OPERACIONAL);

    // Fila expandida: persona seleccionada → carga perezosa de sus registros.
    const [expanded, setExpanded] = useState<number | null>(null);
    const { data: detail, isLoading: detailLoading } = useApiQuery<ExtraHourItem[]>(
        'GET',
        `/extra-hours/person/${expanded ?? 0}`,
        { enabled: expanded != null },
        queryKeys.extraHoursOtrosModelos.byPerson(escId ?? 0, expanded ?? 0),
    );

    // Edición de un registro individual.
    const [editing, setEditing] = useState<ExtraHourItem | null>(null);

    // Borrado de un registro individual.
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [toDelete, setToDelete] = useState<number | null>(null);

    const deleteExtraHour = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `/extra-hours/${v.id}`,
        {
            invalidateKeys: [queryKeys.extraHoursOtrosModelos.all(escId ?? 0)],
            successMessage: 'Registro eliminado con éxito.',
        },
    );

    const itemsPerPage = params.limit;
    const currentPage = Math.floor(params.offset / itemsPerPage) + 1;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handleRefresh = () => startTransition(() => { refetch(); });

    const toggleExpand = (personSk: number) => {
        setExpanded((prev) => (prev === personSk ? null : personSk));
    };

    const openDeleteDialog = (id: number) => {
        setToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (toDelete == null) return;
        try {
            await deleteExtraHour.mutateAsync({ id: toDelete });
        } finally {
            setDeleteDialogOpen(false);
            setToDelete(null);
        }
    };

    const colSpan = 8;

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Horas extra otros modelos</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por persona..."
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

                {/* Tabla agrupada por persona (totales). Click → despliega registros. */}
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[820px]" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Persona</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Registros</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Día</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Noche</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">GVN</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Inst.</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">HAC</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                                </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr><td colSpan={colSpan} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                            ) : persons.length === 0 ? (
                                <tr><td colSpan={colSpan} className="p-8 text-center text-muted-foreground">No se encontraron registros</td></tr>
                            ) : (
                                persons.map((person, idx) => (
                                    <React.Fragment key={person.personSk}>
                                        <TableRow
                                            index={idx}
                                            isSelected={expanded === person.personSk}
                                            onClick={() => toggleExpand(person.personSk)}
                                        >
                                            <td className="p-4">
                                                <span className="text-sm text-foreground">{person.persona}</span>
                                                {person.personaNk && (
                                                    <span className="text-xs text-muted-foreground ml-2">{person.personaNk}</span>
                                                )}
                                            </td>
                                            <td className="text-center p-4"><span className="text-sm text-muted-foreground">{person.recordCount}</span></td>
                                            <td className="text-center p-4"><span className="text-sm text-foreground font-medium">{fmtHours(person.day)}</span></td>
                                            <td className="text-center p-4"><span className="text-sm text-foreground font-medium">{fmtHours(person.convNight)}</span></td>
                                            <td className="text-center p-4"><span className="text-sm text-foreground font-medium">{fmtHours(person.gvn)}</span></td>
                                            <td className="text-center p-4"><span className="text-sm text-foreground font-medium">{fmtHours(person.inst)}</span></td>
                                            <td className="text-center p-4"><span className="text-sm text-foreground font-medium">{fmtHours(person.cta)}</span></td>
                                            <td className="text-center p-4">
                                                {expanded === person.personSk
                                                    ? <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                                    : <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />}
                                            </td>
                                        </TableRow>

                                        {expanded === person.personSk && (
                                            <DetailsRow colSpan={colSpan}>
                                                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                                                    Registros individuales
                                                </div>
                                                {detailLoading ? (
                                                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                                                ) : !detail || detail.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">Sin registros.</p>
                                                ) : (
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="text-xs text-muted-foreground border-b border-details-border">
                                                                <th className="text-left py-2 pr-4 font-medium">ID</th>
                                                                <th className="text-center py-2 px-2 font-medium">Día</th>
                                                                <th className="text-center py-2 px-2 font-medium">Noche</th>
                                                                <th className="text-center py-2 px-2 font-medium">GVN</th>
                                                                <th className="text-center py-2 px-2 font-medium">Inst.</th>
                                                                <th className="text-center py-2 px-2 font-medium">HAC</th>
                                                                <th className="text-left py-2 px-4 font-medium">Observaciones</th>
                                                                {canWrite && <th className="py-2"></th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {detail.map((rec) => (
                                                                <tr key={rec.id} className="border-b border-details-border/50 last:border-0">
                                                                    <td className="py-2 pr-4 text-sm text-muted-foreground">{rec.id}</td>
                                                                    <td className="py-2 px-2 text-center text-sm text-foreground">{fmtHours(rec.day)}</td>
                                                                    <td className="py-2 px-2 text-center text-sm text-foreground">{fmtHours(rec.convNight)}</td>
                                                                    <td className="py-2 px-2 text-center text-sm text-foreground">{fmtHours(rec.gvn)}</td>
                                                                    <td className="py-2 px-2 text-center text-sm text-foreground">{fmtHours(rec.inst)}</td>
                                                                    <td className="py-2 px-2 text-center text-sm text-foreground">{fmtHours(rec.cta)}</td>
                                                                    <td className="py-2 px-4 text-sm text-muted-foreground">{rec.remarks || '—'}</td>
                                                                    {canWrite && (
                                                                        <td className="py-2">
                                                                            <div className="flex items-center justify-end gap-3">
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); setEditing(rec); }}
                                                                                    className="text-info hover:text-info/80 transition-all"
                                                                                    aria-label="Editar registro"
                                                                                >
                                                                                    <Pencil className="w-4 h-4" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); openDeleteDialog(rec.id); }}
                                                                                    className="text-danger hover:text-danger/80 transition-all"
                                                                                    aria-label="Eliminar registro"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </DetailsRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-muted/50 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} personas
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

            {/* Edición (montado por registro: key fuerza estado inicial fresco) */}
            {editing && (
                <RegisterExtraHoursOtrosModelosDialog
                    key={editing.id}
                    open={!!editing}
                    onOpenChange={(open) => { if (!open) setEditing(null); }}
                    mode="edit"
                    initial={editing}
                />
            )}

            {/* Confirmación de borrado */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">¿Eliminar registro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminará permanentemente el registro de horas extra{' '}
                            <span className="font-semibold text-foreground">ID: {toDelete}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteExtraHour.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            disabled={deleteExtraHour.isPending}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {deleteExtraHour.isPending ? (
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

export default HorasExtraOtrosModelos;
