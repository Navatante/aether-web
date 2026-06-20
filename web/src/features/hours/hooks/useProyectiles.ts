import { useState } from 'react'
import { useApiQuery } from '@/lib/apiQuery'
import { queryKeys } from '@/lib/queryKeys'
import { useEscuadrilla } from '@/providers'
import type { CrewProjectilesData, ProjectilesResponse } from '@/types/projectiles'
import type { PredefinedRange, StatsParams } from '@/shared/components/common'

export interface UseProyectilesOptions {
    /** Rango predefinido inicial; debe coincidir con el default del selector. */
    initialTimeRange?: PredefinedRange
}

export interface UseProyectilesResult {
    loading: boolean
    errorMsg: string | undefined
    /** Datos crudos del endpoint (una fila por tripulante de dotación). */
    data: CrewProjectilesData[]
    startDate: string | undefined
    endDate: string | undefined
    /** Handler para el `onDataReceived` de SegmentedDateRangeAether. */
    handleDateRangeChange: (params: StatsParams) => void
}

/**
 * Lógica de la vista de proyectiles por dotación: estado del rango, consulta a
 * `/projectiles/dotaciones` vía TanStack Query. La página solo renderiza.
 * El filtro de dotación (rol) lo aplica el backend.
 */
export function useProyectiles(options: UseProyectilesOptions = {}): UseProyectilesResult {
    const { initialTimeRange = 'ultimos-30-dias' } = options
    const { id: escId } = useEscuadrilla()

    // Solo el rango es estado mutable (lo cambia el selector). El estado inicial se
    // alinea con el default del selector para evitar un fetch extra en el montaje.
    const [rangeParams, setRangeParams] = useState<Record<string, string | undefined>>({
        time_range: initialTimeRange,
    })

    const queryParams: Record<string, string | undefined> = { ...rangeParams }

    const {
        data,
        isFetching: loading,
        error: queryError,
    } = useApiQuery<ProjectilesResponse>(
        'GET',
        '/projectiles/dotaciones',
        { query: queryParams },
        queryKeys.hours.projectiles(escId ?? 0, queryParams),
    )

    const chartData = data?.dotacion ?? []
    const startDate = data?.startDate
    const endDate = data?.endDate
    const errorMsg = queryError
        ? (queryError instanceof Error ? queryError.message : 'Error al obtener los datos')
        : undefined

    // Traduce el rango emitido por el selector al estado de rango del backend.
    const handleDateRangeChange = (params: StatsParams) => {
        if (params.range_type === 'custom' && params.date_from && params.date_to) {
            setRangeParams({
                custom_start_date: params.date_from,
                custom_end_date: params.date_to,
            })
        } else {
            setRangeParams({
                time_range: params.predefined_range ?? 'ultimos-7-dias',
            })
        }
    }

    return { loading, errorMsg, data: chartData, startDate, endDate, handleDateRangeChange }
}
