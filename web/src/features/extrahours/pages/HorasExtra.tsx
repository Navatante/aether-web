import React, { useState, useEffect, useTransition } from 'react';
import { useApiPaginatedQuery, useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla, PermissionLevel, useUser } from '@/providers';
import { useDebouncedValue } from '@/shared/hooks';
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
import { RegisterExtraHoursDialog } from '../components';

// Formatea horas (1 decimal). 0 → "—" para aligerar la tabla.
const fmtHours = (h: number): string => (h ? h.toFixed(1) : '—');

// "YYYY-MM-DD" → "DD/MM/YYYY" sin tocar zona horaria.
const fmtFecha = (f: string): string => {
    const [y, m, d] = f.split('-');
    return y && m && d ? `${d}/${m}/${y}` : f;
};

// Agrupa los registros de una persona por modelo de aeronave (el backend ya los
// devuelve ordenados por modelo, luego fecha desc).
const groupByModel = (records: ExtraHourItem[]): { modelSk: number; modelName: string; items: ExtraHourItem[] }[] => {
    const groups: { modelSk: number; modelName: string; items: ExtraHourItem[] }[] = [];
    for (const rec of records) {
        const last = groups[groups.length - 1];
        if (last && last.modelSk === rec.modelSk) {
            last.items.push(rec);
        } else {
            groups.push({ modelSk: rec.modelSk, modelName: rec.modelName, items: [rec] });
        }
    }
    return groups;
};

// Horas "totales" de un registro = día + noche convencional + GVN (no incluye
// Inst. ni HAC, que son desgloses solapados).
const recordTotal = (rec: ExtraHourItem): number => rec.day + rec.convNight + rec.gvn;

// Totales de un grupo de modelo, separando simulador (isReal=false) de real.
const modelTotals = (items: ExtraHourItem[]): { sim: number; real: number; total: number } => {
    let sim = 0;
    let real = 0;
    for (const rec of items) {
        const t = recordTotal(rec);
        if (rec.isReal) real += t;
        else sim += t;
    }
    return { sim, real, total: sim + real };
};

const HorasExtra = () => {
    const { hasPermission } = useUser();
    const { id: escId } = useEscuadrilla();
    const [isPending, startTransition] = useTransition();
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 300);

    const [params, setParamsState] = useState({ limit: 20, offset: 0, q: '' });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState((prev) => ({ ...prev, ...newParams }));
    };

    // Búsqueda en vivo (300ms): al dejar de teclear filtra y vuelve a la 1ª
    // página. El debounce lo encapsula useDebouncedValue.
    useEffect(() => {
        setParamsState((prev) => ({ ...prev, q: debouncedSearch.trim(), offset: 0 }));
    }, [debouncedSearch]);

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
        queryKey: queryKeys.extraHours.list(escId ?? 0, params),
    });

    const canWrite = hasPermission(PermissionLevel.OPERACIONAL);

    // Fila expandida: persona seleccionada → carga perezosa de sus registros.
    const [expanded, setExpanded] = useState<number | null>(null);
    const { data: detail, isLoading: detailLoading } = useApiQuery<ExtraHourItem[]>(
        'GET',
        `/extra-hours/person/${expanded ?? 0}`,
        { enabled: expanded != null },
        queryKeys.extraHours.byPerson(escId ?? 0, expanded ?? 0),
    );

    // Edición de un registro individual.
    const [editing, setEditing] = useState<ExtraHourItem | null>(null);

    // Borrado de un registro individual.
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [toDelete, setToDelete] = useState<number | null>(null);

    const deleteRecord = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `/extra-hours/${v.id}`,
        {
            invalidateKeys: [queryKeys.extraHours.all(escId ?? 0)],
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
            await deleteRecord.mutateAsync({ id: toDelete });
        } finally {
            setDeleteDialogOpen(false);
            setToDelete(null);
        }
    };

    const colSpan = 9;
    const detailCols = 8 + (canWrite ? 1 : 0); // columnas de la tabla de detalle (para el sub-header de modelo)

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Horas extra</GradientTitle>
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

                {/* Tabla agrupada por persona (totales de todos los modelos). Click → despliega registros. */}
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[900px]" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Persona</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Registros</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Día</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Noche</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">GVN</th>
                                    <th className="text-center p-4 font-semibold text-primary border-l border-border/60 bg-primary/5">Total</th>
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
                                            <td className="text-center p-4 border-l border-border/60 bg-primary/5"><span className="text-sm text-primary font-semibold tabular-nums">{fmtHours(person.day + person.convNight + person.gvn)}</span></td>
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
                                                    Registros individuales por modelo
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
                                                                <th className="text-left py-2 pr-4 font-medium">Fecha</th>
                                                                <th className="text-center py-2 px-2 font-medium">Tipo</th>
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
                                                            {groupByModel(detail).map((group) => {
                                                                const totals = modelTotals(group.items);
                                                                return (
                                                                <React.Fragment key={group.modelSk}>
                                                                    <tr className="bg-muted/40">
                                                                        <td colSpan={detailCols} className="py-2 px-2">
                                                                            <div className="flex items-center text-xs">
                                                                                <span className="w-62 shrink-0 font-semibold uppercase tracking-wide text-foreground">
                                                                                    {group.modelName}
                                                                                </span>
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="flex items-baseline justify-between gap-2">
                                                                                        <span className="text-muted-foreground">Sim</span>
                                                                                        <span className="font-semibold text-foreground tabular-nums">{totals.sim.toFixed(1)} h</span>
                                                                                    </span>
                                                                                    <span className="h-3 w-px bg-details-border" aria-hidden />
                                                                                    <span className="flex items-baseline justify-between gap-2">
                                                                                        <span className="text-muted-foreground">Real</span>
                                                                                        <span className="font-semibold text-foreground tabular-nums">{totals.real.toFixed(1)} h</span>
                                                                                    </span>
                                                                                    <span className="h-3 w-px bg-details-border" aria-hidden />
                                                                                    <span className="flex items-baseline justify-between gap-2">
                                                                                        <span className="text-muted-foreground">Total</span>
                                                                                        <span className="font-semibold text-primary tabular-nums">{totals.total.toFixed(1)} h</span>
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    {group.items.map((rec) => (
                                                                        <tr key={rec.id} className="border-b border-details-border/50 last:border-0">
                                                                            <td className="py-2 pr-4 text-sm text-muted-foreground">{rec.id}</td>
                                                                            <td className="py-2 pr-4 text-sm text-muted-foreground">{fmtFecha(rec.date)}</td>
                                                                            <td className="py-2 px-2 text-center">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${rec.isReal ? 'bg-success-muted text-success-muted-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                                                    {rec.isReal ? 'Real' : 'Sim'}
                                                                                </span>
                                                                            </td>
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
                                                                </React.Fragment>
                                                                );
                                                            })}
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
                <RegisterExtraHoursDialog
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
                        <AlertDialogCancel disabled={deleteRecord.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            disabled={deleteRecord.isPending}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {deleteRecord.isPending ? (
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

export default HorasExtra;
