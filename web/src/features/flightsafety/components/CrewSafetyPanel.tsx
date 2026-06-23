// Widget "Mis reconocimientos" del Panel del tripulante. Accesible a cualquier
// autenticado: muestra solo los datos propios (GET /flight-safety/me). Una
// tarjeta por reconocimiento con caducidad, estado, cita de renovación y, en el
// médico, lugar + aviso CIMA.

import { HeartPulse, Waves, Wind, CalendarClock, ShieldAlert } from 'lucide-react';
import { useApiQuery } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { formatDateDisplay } from '@/shared/components/common';
import type { MeResponse, MedicalSummaryItem, ExamSummaryItem } from '@/types/generated/flightsafety';
import {
    EXAM_CONFIG, STATUS_META, deriveStatus, cimaState, daysUntil, type ExamType,
} from '../flightsafety';

const ICONS: Record<ExamType, typeof HeartPulse> = {
    medical: HeartPulse,
    dunker: Waves,
    hyperbaric: Wind,
};

function relDays(date: string): string {
    const d = daysUntil(date);
    if (d === null) return '';
    if (d < 0) return `caducó hace ${Math.abs(d)} días`;
    if (d === 0) return 'caduca hoy';
    return `caduca en ${d} días`;
}

function ExamCard({ type, item }: { type: ExamType; item?: MedicalSummaryItem | ExamSummaryItem }) {
    const cfg = EXAM_CONFIG[type];
    const Icon = ICONS[type];
    const status = item ? deriveStatus(item, type) : 'SIN_DATOS';
    const meta = STATUS_META[status];
    const medical = type === 'medical' ? (item as MedicalSummaryItem | undefined) : null;
    const cima = medical ? cimaState(medical.next_cima_due) : 'NONE';

    return (
        <div className={`rounded-lg border p-4 ${meta.row || 'bg-card'}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {cfg.short}
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                </span>
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Caducidad</span>
                    <span className="text-foreground">
                        {item?.expiry_date ? (
                            <>
                                {formatDateDisplay(item.expiry_date)}
                                <span className="ml-1 text-xs text-muted-foreground">({relDays(item.expiry_date)})</span>
                            </>
                        ) : '—'}
                    </span>
                </div>

                {item?.scheduled_date && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Renovación</span>
                        <span className="inline-flex items-center gap-1 text-info-muted-foreground">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {formatDateDisplay(item.scheduled_date)}
                        </span>
                    </div>
                )}

                {medical && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Lugar</span>
                        <span className="text-foreground">{medical.place || '—'}</span>
                    </div>
                )}

                {medical && cima !== 'NONE' && (
                    <div className={`mt-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${cima === 'OVERDUE' ? 'bg-danger-muted text-danger-muted-foreground border-danger/30' : 'bg-warning-muted text-warning-muted-foreground border-warning/30'}`}>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {cima === 'OVERDUE'
                            ? 'El reconocimiento en CIMA está caducado'
                            : `Próximo reconocimiento en CIMA (${medical.next_cima_due ? formatDateDisplay(medical.next_cima_due) : ''})`}
                    </div>
                )}
            </div>
        </div>
    );
}

export function CrewSafetyPanel() {
    const { id: escId } = useEscuadrilla();
    const { data, isLoading } = useApiQuery<MeResponse>(
        'GET', '/flight-safety/me', undefined, queryKeys.flightSafety.me(escId ?? 0),
    );

    return (
        <div>
            <h3 className="text-lg font-semibold mb-2">Mis reconocimientos</h3>
            {isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
                <div className="space-y-3">
                    <ExamCard type="medical" item={data?.medical} />
                    <ExamCard type="dunker" item={data?.dunker} />
                    <ExamCard type="hyperbaric" item={data?.hyperbaric} />
                </div>
            )}
        </div>
    );
}
