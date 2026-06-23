// Lógica de la página-tablero de un tipo de reconocimiento. Normaliza el resumen
// por persona (médico o booleano) a una fila uniforme con estado derivado, y
// expone búsqueda, filtro por estado, recuentos y borrado.

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla, useUser, PermissionLevel } from '@/providers';
import type { MedicalSummaryItem, ExamSummaryItem } from '@/types/generated/flightsafety';
import {
    EXAM_CONFIG, deriveStatus, cimaState, personLabel, personSearchText,
    type ExamType, type ExamStatus, type CimaState,
} from '../flightsafety';

export interface ExamRow {
    personSk: number;
    label: string;
    search: string;
    status: ExamStatus;
    doneSk: number;
    doneDate: string;
    expiryDate: string;
    resultText: string;
    scheduledSk: number;
    scheduledDate: string;
    // médico
    remark: string;           // observaciones del último realizado
    place: string;            // lugar del último realizado
    scheduledPlace: string;   // lugar de la cita programada (nombre)
    scheduledPlaceFk: number; // lugar de la cita programada (fk, 0 = ninguno)
    nextCimaDue: string;
    cima: CimaState;
}

const EMPTY: (MedicalSummaryItem | ExamSummaryItem)[] = [];

function boolResultLabel(r: boolean | undefined): string {
    if (r === true) return 'Apto';
    if (r === false) return 'No apto';
    return '—';
}

const queryKeyFor = (escId: number, type: ExamType) =>
    type === 'medical' ? queryKeys.flightSafety.medical(escId)
        : type === 'dunker' ? queryKeys.flightSafety.dunker(escId)
            : queryKeys.flightSafety.hyperbaric(escId);

export function useExamTracking(type: ExamType) {
    const cfg = EXAM_CONFIG[type];
    const { id: escId } = useEscuadrilla();
    const { hasPermission } = useUser();
    const canWrite = hasPermission(PermissionLevel.SEGURIDAD);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<ExamStatus | 'ALL'>('ALL');

    const { data, isLoading, isFetching, refetch } = useApiQuery<(MedicalSummaryItem | ExamSummaryItem)[]>(
        'GET', cfg.apiPath, undefined, queryKeyFor(escId ?? 0, type),
    );

    const deleteExam = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `${cfg.apiPath}/${v.id}`,
        { invalidateKeys: [queryKeys.flightSafety.all(escId ?? 0)], successMessage: 'Registro eliminado.' },
    );

    const rows: ExamRow[] = (data ?? EMPTY).map((it) => {
        const medical = type === 'medical' ? (it as MedicalSummaryItem) : null;
        const status = deriveStatus(it, type);
        return {
            personSk: it.person_sk,
            label: personLabel(it),
            search: personSearchText(it),
            status,
            doneSk: it.done_sk,
            doneDate: it.done_date,
            expiryDate: it.expiry_date,
            resultText: medical ? medical.result : boolResultLabel((it as ExamSummaryItem).result),
            scheduledSk: it.scheduled_sk,
            scheduledDate: it.scheduled_date,
            remark: medical ? medical.remark : '',
            place: medical ? medical.place : '',
            scheduledPlace: medical ? medical.scheduled_place : '',
            scheduledPlaceFk: medical ? medical.scheduled_place_fk : 0,
            nextCimaDue: medical ? medical.next_cima_due : '',
            cima: medical ? cimaState(medical.next_cima_due) : 'NONE',
        };
    });

    // Recuentos por estado (sobre todo el conjunto, sin filtrar).
    const counts = rows.reduce<Record<ExamStatus, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, { VIGENTE: 0, POR_CADUCAR: 0, URGENTE: 0, CADUCADO: 0, PROGRAMADO: 0, SIN_DATOS: 0 });

    // El orden lo fija el backend por order_position (vista detall.v_person_ordered):
    // rango → antigüedad → … (orden oficial). Aquí solo se filtra, preservando ese orden.
    const q = search.trim().toLowerCase();
    const filtered = rows
        .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
        .filter((r) => (q ? r.search.includes(q) : true));

    return {
        cfg, canWrite,
        rows: filtered, counts, total: rows.length,
        isLoading, isFetching, refetch,
        search, setSearch, statusFilter, setStatusFilter,
        deleteExam: (id: number) => deleteExam.mutate({ id }),
        isDeleting: deleteExam.isPending,
    };
}
