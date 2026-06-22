import { useState } from 'react';
import {
    ChevronLeft, ChevronRight, RefreshCw, Trash2, Pencil,
} from 'lucide-react';
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
    SearchInput,
    formatDateDisplay,
} from '@/shared/components/common';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { FuelItem } from '@/types/generated/fuel';
import { useCombustible } from '../hooks/useCombustible';
import { MONTHS_ES } from '../fuel';
import FuelSummary from '../components/FuelSummary';
import { RegisterFuelDialog } from '../components';

export default function Combustible() {
    const {
        items, totalCount, isLoading,
        summary, summaryLoading, periodLabel,
        canWrite,
        month, setMonth, year, setYear,
        searchQuery, setSearchQuery,
        editing, setEditing, handleDelete, isDeleting,
        isPending, handleRefresh,
        itemsPerPage, currentPage, totalPages, goToPage,
    } = useCombustible();

    const [toDelete, setToDelete] = useState<FuelItem | null>(null);
    const colCount = canWrite ? 10 : 9; // 9 columnas de datos + acciones
    const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

    const onConfirmDelete = () => {
        if (toDelete) handleDelete(toDelete.id);
        setToDelete(null);
    };

    return (
        <div className="h-full overflow-y-auto p-3 sm:p-6 pb-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <GradientTitle>Combustible</GradientTitle>
            </div>

            <div className="w-full mx-auto space-y-4">
                {/* Controles: mes/año + búsqueda por ID + actualizar */}
                <PageControls>
                    <div className="flex flex-wrap gap-4 items-center">
                        <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Mes">{MONTHS_ES[month - 1]}</SelectValue></SelectTrigger>
                            <SelectContent>
                                {MONTHS_ES.map((name, idx) => (
                                    <SelectItem key={name} value={String(idx + 1)}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
                            <SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por ID..."
                            />
                        </div>

                        <ActionButton
                            variant="refresh"
                            icon={RefreshCw}
                            label="Actualizar"
                            onClick={(e) => {
                                handleRefresh();
                                const icon = e.currentTarget.querySelector('svg');
                                if (icon) {
                                    icon.classList.remove('animate-spin-once');
                                    requestAnimationFrame(() => icon.classList.add('animate-spin-once'));
                                }
                            }}
                            disabled={isPending}
                            loading={isPending}
                        />
                    </div>
                </PageControls>

                {/* Resumen del mes (no afectado por la búsqueda por ID) */}
                <FuelSummary summary={summary} isLoading={summaryLoading} periodLabel={periodLabel} />

                {/* Tabla de repostajes */}
                <PageTableContainer className="flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px]" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Fecha</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Aeronave</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Lugar</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Tipo</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Pagador</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Evento</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Fase</th>
                                    <th className="text-right p-4 font-semibold text-table-header-foreground">Litros</th>
                                    {canWrite && <th className="p-4" />}
                                </tr>
                            </StickyTableHeader>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={colCount} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={colCount} className="p-8 text-center text-muted-foreground">No se encontraron repostajes</td></tr>
                                ) : (
                                    items.map((rec, idx) => (
                                        <TableRow key={rec.id} index={idx}>
                                            <td className="p-4 text-sm text-muted-foreground">{rec.id}</td>
                                            <td className="p-4 text-sm text-muted-foreground">{formatDateDisplay(rec.fuel_date)}</td>
                                            <td className="text-center p-4 text-sm text-foreground">{rec.aircraft_number}</td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {rec.fuel_place_name}
                                                <span className="block text-xs text-muted-foreground/70">{rec.fuel_place_type}</span>
                                            </td>
                                            <td className="text-center p-4 text-sm text-muted-foreground">{rec.fuel_type}</td>
                                            <td className="text-center p-4 text-sm text-muted-foreground">{rec.fuel_payer_abbrev}</td>
                                            <td className="text-center p-4 text-sm text-muted-foreground">
                                                {rec.event_name}
                                                <span className="block text-xs text-muted-foreground/70">{rec.event_place}</span>
                                            </td>
                                            <td className="text-center p-4 text-sm text-muted-foreground">{rec.fuel_phase}</td>
                                            <td className="text-right p-4 text-sm text-foreground font-mono tabular-nums">{rec.fuel_qty.toLocaleString('es-ES')}</td>
                                            {canWrite && (
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => setEditing(rec)}
                                                            className="text-info hover:text-info/80 transition-all"
                                                            aria-label="Editar repostaje"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setToDelete(rec)}
                                                            className="text-danger hover:text-danger/80 transition-all"
                                                            aria-label="Eliminar repostaje"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
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
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} repostajes
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                                        return (
                                            <button key={pageNum} onClick={() => goToPage(pageNum)} className={`px-3 py-1 rounded-lg transition-colors ${currentPage === pageNum ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className={`p-2 rounded-lg transition-colors ${currentPage === totalPages ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}
                </PageTableContainer>
            </div>

            {/* Edición (montado por registro: key fuerza estado inicial fresco) */}
            {editing && (
                <RegisterFuelDialog
                    key={editing.id}
                    open={!!editing}
                    onOpenChange={(open) => { if (!open) setEditing(null); }}
                    mode="edit"
                    initial={editing}
                />
            )}

            {/* Confirmación de borrado */}
            <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">¿Eliminar repostaje?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminará permanentemente el repostaje{' '}
                            <span className="font-semibold text-foreground">ID: {toDelete?.id}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); onConfirmDelete(); }}
                            disabled={isDeleting}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {isDeleting ? (
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
}
