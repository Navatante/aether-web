// Página-tablero genérica de un tipo de reconocimiento (médico/dunker/hiperbárica).
// Solo render: la lógica vive en useExamTracking. Las tres páginas concretas son
// envoltorios finos que fijan el `type`.

import { useState } from 'react';
import { RefreshCw, Trash2, Pencil, ClipboardCheck, CalendarPlus, ShieldAlert } from 'lucide-react';
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
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useExamTracking, type ExamRow } from '../hooks/useExamTracking';
import {
    STATUS_META, daysUntil, type ExamType, type ExamStatus,
} from '../flightsafety';
import RegisterExamDialog from './dialogs/RegisterExamDialog';
import type { ExamDialogInitial } from '../hooks/useRegisterExam';

const SUMMARY_ORDER: ExamStatus[] = ['CADUCADO', 'URGENTE', 'POR_CADUCAR', 'PROGRAMADO', 'VIGENTE'];

function StatusBadge({ status }: { status: ExamStatus }) {
    const m = STATUS_META[status];
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${m.badge}`}>
            {m.label}
        </span>
    );
}

/** Caducidad con los días restantes ("en N días" / "hace N días"). */
function ExpiryCell({ date }: { date: string }) {
    if (!date) return <span className="text-muted-foreground">—</span>;
    const d = daysUntil(date);
    const rel = d === null ? '' : d < 0 ? `hace ${Math.abs(d)} d` : d === 0 ? 'hoy' : `en ${d} d`;
    return (
        <div className="leading-tight">
            <div className="text-foreground">{formatDateDisplay(date)}</div>
            <div className="text-xs text-muted-foreground">{rel}</div>
        </div>
    );
}

export default function FlightSafetyPage({ type }: { type: ExamType }) {
    const {
        cfg, canWrite, rows, counts, total,
        isLoading, isFetching, refetch,
        search, setSearch, statusFilter, setStatusFilter,
        deleteExam, isDeleting,
    } = useExamTracking(type);

    // Diálogo de alta / edición / registrar resultado.
    const [dialog, setDialog] = useState<{ mode: 'create' | 'edit' | 'complete'; initial?: ExamDialogInitial; personSk?: number } | null>(null);
    // Cancelar cita programada.
    const [toCancel, setToCancel] = useState<ExamRow | null>(null);

    const isMedical = type === 'medical';
    const colCount = 5 + (isMedical ? 3 : 0) + (canWrite ? 1 : 0);

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="mb-6 text-center flex-shrink-0">
                <GradientTitle>{cfg.label}</GradientTitle>
                <p className="text-sm text-muted-foreground mt-1">
                    Seguimiento de caducidades y citas de renovación
                    {cfg.validityYears === 1 ? ' · validez anual' : ` · validez ${cfg.validityYears} años`}
                </p>
            </div>

            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Tarjetas resumen (clic = filtrar por estado) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4 flex-shrink-0">
                    {SUMMARY_ORDER.map((st) => {
                        const active = statusFilter === st;
                        return (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(active ? 'ALL' : st)}
                                className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${active ? 'ring-2 ring-primary' : ''} ${STATUS_META[st].badge}`}
                            >
                                <div className="text-2xl font-semibold tabular-nums">{counts[st]}</div>
                                <div className="text-xs font-medium">{STATUS_META[st].label}</div>
                            </button>
                        );
                    })}
                </div>

                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por persona o indicativo..."
                            />
                        </div>
                        <ActionButton
                            variant="refresh"
                            icon={RefreshCw}
                            label="Actualizar"
                            className="cursor-pointer"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            loading={isFetching}
                        />
                    </div>
                </PageControls>

                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[820px]" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Persona</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Caducidad</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Estado</th>
                                    <th className="text-center p-4 font-semibold text-table-header-foreground">Resultado</th>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Cita programada</th>
                                    {isMedical && <th className="text-left p-4 font-semibold text-table-header-foreground">Lugar</th>}
                                    {isMedical && <th className="text-center p-4 font-semibold text-table-header-foreground">CIMA (4 años)</th>}
                                    {isMedical && <th className="text-left p-4 font-semibold text-table-header-foreground">Observaciones</th>}
                                    {canWrite && <th className="p-4" />}
                                </tr>
                            </StickyTableHeader>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={colCount} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={colCount} className="p-8 text-center text-muted-foreground">Sin resultados</td></tr>
                                ) : (
                                    rows.map((r, idx) => (
                                        <TableRow key={r.personSk} index={idx} className={`cursor-default ${STATUS_META[r.status].row}`}>
                                            <td className="p-4">
                                                <span className="text-sm text-foreground">{r.name}</span>
                                                {r.nk && (
                                                    <span className="text-xs text-muted-foreground ml-2">{r.nk}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm"><ExpiryCell date={r.expiryDate} /></td>
                                            <td className="p-4 text-center"><StatusBadge status={r.status} /></td>
                                            <td className="p-4 text-center text-sm text-muted-foreground">{r.resultText || '—'}</td>
                                            <td className="p-4 text-sm">
                                                {r.scheduledDate ? (
                                                    <span className="inline-flex items-center rounded-md border border-info/30 bg-info-muted px-2 py-0.5 text-xs font-medium text-info-muted-foreground">
                                                        {formatDateDisplay(r.scheduledDate)}
                                                        {isMedical && r.scheduledPlace && ` · ${r.scheduledPlace}`}
                                                    </span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </td>
                                            {isMedical && (
                                                <td className="p-4 text-sm text-muted-foreground">{r.place || '—'}</td>
                                            )}
                                            {isMedical && (
                                                <td className="p-4 text-center text-sm">
                                                    {r.cima === 'NONE' ? (
                                                        <span className="text-muted-foreground">{r.nextCimaDue ? formatDateDisplay(r.nextCimaDue) : '—'}</span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${r.cima === 'OVERDUE' ? 'bg-danger-muted text-danger-muted-foreground border-danger/30' : 'bg-warning-muted text-warning-muted-foreground border-warning/30'}`}>
                                                            <ShieldAlert className="w-3 h-3" />
                                                            {r.cima === 'OVERDUE' ? 'CIMA caducado' : 'Próximo en CIMA'}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            {isMedical && (() => {
                                                // En una cita PROGRAMADA la observación relevante es la de la cita;
                                                // si no tiene, cae a la del último realizado.
                                                const obs = r.scheduledRemark || r.remark;
                                                return (
                                                    <td className="p-4 text-sm text-muted-foreground max-w-[16rem] truncate" title={obs}>
                                                        {obs || '—'}
                                                    </td>
                                                );
                                            })()}
                                            {canWrite && (
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-3">
                                                        {r.scheduledSk > 0 && (
                                                            <button
                                                                onClick={() => setDialog({ mode: 'complete', initial: { id: r.scheduledSk, personSk: r.personSk, phase: 'realizado', date: r.scheduledDate, scheduledDate: r.scheduledDate, scheduledPlaceFk: r.scheduledPlaceFk } })}
                                                                className="cursor-pointer text-success hover:text-success/80 transition-all"
                                                                aria-label="Registrar resultado de la cita"
                                                                title="Registrar resultado"
                                                            >
                                                                <ClipboardCheck className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setDialog({ mode: 'create', personSk: r.personSk })}
                                                            className="cursor-pointer text-info hover:text-info/80 transition-all"
                                                            aria-label="Programar renovación"
                                                            title="Programar renovación"
                                                        >
                                                            <CalendarPlus className="w-4 h-4" />
                                                        </button>
                                                        {r.doneSk > 0 && (
                                                            <button
                                                                onClick={() => setDialog({ mode: 'edit', initial: { id: r.doneSk, personSk: r.personSk, phase: 'realizado', date: r.doneDate, expiryDate: r.expiryDate } })}
                                                                className="cursor-pointer text-muted-foreground hover:text-foreground transition-all"
                                                                aria-label="Editar último reconocimiento"
                                                                title="Editar último"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {r.scheduledSk > 0 && (
                                                            <button
                                                                onClick={() => setToCancel(r)}
                                                                className="cursor-pointer text-danger hover:text-danger/80 transition-all"
                                                                aria-label="Cancelar cita programada"
                                                                title="Cancelar cita"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </PageTableContainer>

                <div className="text-sm text-muted-foreground mt-3 flex-shrink-0">
                    {rows.length} de {total} personas
                </div>
            </div>

            {/* Alta / edición */}
            {dialog && (
                <RegisterExamDialog
                    type={type}
                    open
                    onOpenChange={(open) => { if (!open) setDialog(null); }}
                    mode={dialog.mode}
                    initial={dialog.initial}
                    initialPersonSk={dialog.personSk}
                />
            )}

            {/* Cancelar cita programada (borra el registro PROGRAMADO) */}
            <AlertDialog open={!!toCancel} onOpenChange={(open) => { if (!open) setToCancel(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">¿Cancelar la cita programada?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará la cita de renovación de{' '}
                            <span className="font-semibold text-foreground">{toCancel?.label}</span>. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); if (toCancel) deleteExam(toCancel.scheduledSk); setToCancel(null); }}
                            disabled={isDeleting}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {isDeleting ? 'Cancelando...' : 'Cancelar cita'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
