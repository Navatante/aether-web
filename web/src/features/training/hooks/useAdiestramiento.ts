// Modelo + lógica de estado/datos de las páginas de Adiestramiento
// (Pilotos / Dotaciones). La página queda solo-render (convención 1 del
// CLAUDE.md raíz); ambas variantes comparten este hook.

import { useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';

import { useApiQuery } from "@/lib/apiQuery";
import { useEscuadrilla } from "@/providers";
import { byPlanThenName } from "@/features/training/blocks";

// ===== Modelo =====

export interface Papeleta {
    papeleta_sk: number;
    papeleta_name: string;
    papeleta_description: string;
    papeleta_block: string;
    papeleta_plan: string;
    papeleta_order: number | null;
    // El backend devuelve el CRP en un campo distinto según el rol; la variante
    // elige cuál leer vía `crpValue`.
    papeleta_pilot_crp_value?: number;
    papeleta_dv_crp_value?: number;
    papeleta_expiration: number;
}

export interface PapeletaRealizada {
    session_fk: number;
    dias_transcurridos: number;
    dias_restantes: number;
    estado: 'Vigente' | 'Alerta' | 'Expirado';
}

export interface Persona {
    person_sk: number;
    person_nk: string;
    full_name: string;
    crp: number;
    dias_sin_volar: number;
    dias_sin_vuelo_real: number;
    dias_sin_simulador: number;
    order_position: number;
    papeletas_realizadas: PapeletaRealizada[] | null;
}

export interface PapeletasPersonasData {
    papeletas: Papeleta[];
    crp_medio: number;
    airflow_medio: number;
    personas: Persona[];
}

export type StatusFilter = 'Todos los estados' | 'Vigente' | 'Alerta' | 'Expirado';

// Periodo de vuelo (operations.period): filtra las celdas por papeleta_crew_count_period_fk.
// 0 = todos; 1 = Día, 2 = Noche convencional (NC), 3 = GVN.
export type PeriodFilter = 0 | 1 | 2 | 3;

export const PERIOD_OPTIONS: { value: PeriodFilter; label: string; activeClass: string }[] = [
    { value: 0, label: 'All', activeClass: 'bg-primary text-primary-foreground' },
    { value: 1, label: 'Día', activeClass: 'bg-info text-info-foreground' },
    { value: 2, label: 'NC', activeClass: 'bg-danger text-danger-foreground' },
    { value: 3, label: 'GVN', activeClass: 'bg-success text-success-foreground' },
];

export const ESTADO_LABEL: Record<string, string> = {
    Expirado: '⚠️ Expirado',
    Alerta: '⏰ Próximo a vencer',
    Vigente: '✅ Vigente',
};

export interface AdiestramientoVariant {
    /** Título de la página. */
    title: string;
    /** Roles que pide el endpoint (CSV). */
    roles: string;
    /** Bloques que pide el endpoint (CSV). */
    bloques: string;
    /** Selector de queryKey del factory (pilotos | dotaciones). */
    queryKey: (escId: number, args: Record<string, unknown>) => QueryKey;
    /** Campo CRP a mostrar en el tooltip de cada papeleta. */
    crpValue: (p: Papeleta) => number | undefined;
}

// ===== Hook =====

export function useAdiestramiento(variant: AdiestramientoVariant) {
    const { id: escId } = useEscuadrilla();
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(0);
    const adiestramientoArgs = {
        roles: variant.roles,
        bloques: variant.bloques,
        periodo: String(periodFilter),
    };
    const { data, isLoading, error: queryError, refetch } = useApiQuery<PapeletasPersonasData>(
        'GET',
        '/training/adiestramiento',
        { query: adiestramientoArgs },
        variant.queryKey(escId ?? 0, adiestramientoArgs),
    );
    const error = queryError?.message ?? null;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos los estados');
    const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
    const [selectedPlan, setSelectedPlan] = useState<string>('Todos los planes');
    const [selectedBlock, setSelectedBlock] = useState<string>('Todos los bloques');

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    // Planes y bloques únicos (derivados del cache; React Compiler memoiza).
    const uniquePlans = data ? [...new Set((data.papeletas ?? []).map(p => p.papeleta_plan))].sort() : [];
    const uniqueBlocks = data ? [...new Set((data.papeletas ?? []).map(p => p.papeleta_block))].sort() : [];

    // Estado de una papeleta para una persona.
    const getPapeletaStatus = (persona: Persona, papeletaSk: number): PapeletaRealizada | null => {
        if (!persona.papeletas_realizadas) return null;
        return persona.papeletas_realizadas.find(pr => pr.session_fk === papeletaSk) || null;
    };

    const togglePersona = (personNk: string) => {
        setSelectedPersonas(prev => {
            const newSet = new Set(prev);
            if (newSet.has(personNk)) {
                newSet.delete(personNk);
            } else {
                newSet.add(personNk);
            }
            return newSet;
        });
    };

    // Personas visibles (filtradas por selección).
    const visiblePersonas = (() => {
        if (!data) return [];
        if (selectedPersonas.size === 0) return data.personas ?? [];
        return (data.personas ?? []).filter(p => selectedPersonas.has(p.person_nk));
    })();

    // Papeletas filtradas.
    const filteredPapeletas = (() => {
        if (!data) return [];

        const result = (data.papeletas ?? []).filter(papeleta => {
            // Filtro por periodo según prefijo del nombre:
            //   Día → oculta 'G-' y 'N-'; NC → oculta 'G-'; GVN → oculta 'N-'.
            const name = papeleta.papeleta_name;
            if (periodFilter === 1 && (name.startsWith('G-') || name.startsWith('N-'))) {
                return false;
            }
            if (periodFilter === 2 && name.startsWith('G-')) {
                return false;
            }
            if (periodFilter === 3 && name.startsWith('N-')) {
                return false;
            }

            // Filtro de búsqueda (nombre y descripción)
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesName = papeleta.papeleta_name.toLowerCase().includes(term);
                const matchesDescription = papeleta.papeleta_description.toLowerCase().includes(term);
                if (!matchesName && !matchesDescription) {
                    return false;
                }
            }

            // Filtro de plan
            if (selectedPlan !== 'Todos los planes' && papeleta.papeleta_plan !== selectedPlan) {
                return false;
            }

            // Filtro de bloque
            if (selectedBlock !== 'Todos los bloques' && papeleta.papeleta_block !== selectedBlock) {
                return false;
            }

            // Filtro de estado
            if (statusFilter !== 'Todos los estados') {
                const hasStatus = visiblePersonas.some(persona => {
                    const status = getPapeletaStatus(persona, papeleta.papeleta_sk);
                    return status?.estado === statusFilter;
                });
                if (!hasStatus) return false;
            }

            return true;
        });

        return result.sort(byPlanThenName);
    })();

    return {
        data,
        isLoading,
        error,
        refetch,
        isRefreshing,
        handleRefresh,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        selectedPlan,
        setSelectedPlan,
        selectedBlock,
        setSelectedBlock,
        selectedPersonas,
        togglePersona,
        periodFilter,
        setPeriodFilter,
        uniquePlans,
        uniqueBlocks,
        visiblePersonas,
        filteredPapeletas,
        getPapeletaStatus,
    };
}
