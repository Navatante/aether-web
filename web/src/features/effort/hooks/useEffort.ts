// Estado, query y datos derivados de la página de Esfuerzo. La página queda
// solo-render (convención 1 del CLAUDE.md raíz).

import { useState } from "react";
import { format } from "date-fns";

import { useApiQuery } from "@/lib/apiQuery";
import { useEscuadrilla } from "@/providers";
import { queryKeys } from "@/lib/queryKeys";

// Tipos para los datos del stored procedure
export interface Esfuerzo {
    full_name: string,
    escala: string,
    dias_esfuerzo: number
}

// Escalas disponibles para el filtro.
export const ESCALAS = ['Oficiales', 'Suboficiales', 'Tropa y marinería'];

export function useEffort() {
    const [fechaFin, setFechaFin] = useState<Date>(new Date());
    const [escalaFilter, setEscalaFilter] = useState<Set<string>>(new Set());
    const [calendarOpen, setCalendarOpen] = useState(false);

    const [queryParams, setQueryParams] = useState({ fechaFin: format(new Date(), 'yyyy-MM-dd') });
    const { id: escId } = useEscuadrilla();

    // El backend devuelve { items: Esfuerzo[] }; useApiQuery devuelve el objeto crudo.
    const {
        data: result,
        isFetching,
        refetch,
    } = useApiQuery<{ items: Esfuerzo[] }>(
        'GET',
        '/esfuerzo',
        { query: queryParams },
        queryKeys.effort.list(escId ?? 0, queryParams),
    );
    const data: Esfuerzo[] = result?.items ?? [];

    const handleFechaChange = (date: Date | undefined) => {
        if (date) {
            setFechaFin(date);
            setQueryParams({ fechaFin: format(date, 'yyyy-MM-dd') });
            setCalendarOpen(false);
        }
    };

    const chartData = (() => {
        let filtered = [...data]

        // Filtrar por escala
        if (escalaFilter.size > 0) {
            filtered = filtered.filter(p => escalaFilter.has(p.escala))
        }

        // Ordenar: primero por días (ascendente), luego por índice original invertido (para empates)
        const withIndex = filtered.map((item, index) => ({ item, originalIndex: index }))

        withIndex.sort((a, b) => {
            const diasA = a.item.dias_esfuerzo
            const diasB = b.item.dias_esfuerzo

            if (diasA !== diasB) {
                return diasA - diasB
            }
            return b.originalIndex - a.originalIndex
        })

        // Función para asignar color según los días
        const getBarColor = (days: number) => {
            if (days >= 210) return "var(--effort-high)"
            if (days >= 168) return "var(--effort-mid)"
            return "var(--effort-low)"
        }

        // Mapear al formato final con colores
        return withIndex.map(({ item }) => ({
            fullName: item.full_name,
            days: item.dias_esfuerzo,
            fill: getBarColor(item.dias_esfuerzo)
        }))
    })()

    const chartHeight = chartData.length * 35;

    const toggleEscala = (escala: string) => {
        setEscalaFilter(prev => {
            const next = new Set(prev)
            if (next.has(escala)) {
                next.delete(escala)
            } else {
                next.add(escala)
            }
            return next
        })
    }

    return {
        fechaFin,
        calendarOpen,
        setCalendarOpen,
        handleFechaChange,
        escalaFilter,
        toggleEscala,
        chartData,
        chartHeight,
        isFetching,
        refetch,
    };
}
