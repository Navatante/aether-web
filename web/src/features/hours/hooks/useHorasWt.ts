import { useCallback, useMemo, useState } from 'react'
import { useApiQuery } from '@/lib/apiQuery'
import { queryKeys } from '@/lib/queryKeys'
import { useEscuadrilla } from '@/providers'
import type { WtResponse } from '@/types/hours'
import type { PredefinedRange, StatsParams } from '@/shared/components/common'

export interface UseHorasWtOptions {
    /** Rol de persona a consultar (filtro del backend). Por defecto 'Dotación'. */
    personRol?: string
    /** Rango predefinido inicial; debe coincidir con el default del selector. */
    initialTimeRange?: PredefinedRange
}

export interface UseHorasWtResult {
    loading: boolean
    errorMsg: string | undefined
    /** Horas de Winch Trim por persona. */
    chartData: WtResponse['tripulantes']
    startDate: string | undefined
    endDate: string | undefined
    /** Handler para el `onDataReceived` de SegmentedDateRangeAether. */
    handleDateRangeChange: (params: StatsParams) => void
}

/**
 * Lógica de la vista de horas en Winch Trim (operations.wt_hour): estado del
 * rango, consulta a `/hours/wt` vía TanStack Query. La página solo renderiza.
 * No hay modo "Totales" (las horas de Winch Trim no se incluyen en Totales).
 */
export function useHorasWt(options: UseHorasWtOptions = {}): UseHorasWtResult {
    const { personRol = 'Dotación', initialTimeRange = 'ultimos-30-dias' } = options
    const { id: escId } = useEscuadrilla()

    // Solo el rango es estado mutable (lo cambia el selector). El estado inicial se
    // alinea con el default del selector para evitar un fetch extra en el montaje.
    const [rangeParams, setRangeParams] = useState<Record<string, string | undefined>>({
        time_range: initialTimeRange,
    })

    const queryParams = useMemo<Record<string, string | undefined>>(
        () => ({ person_rol: personRol, ...rangeParams }),
        [personRol, rangeParams],
    )

    const {
        data,
        isFetching: loading,
        error: queryError,
    } = useApiQuery<WtResponse>(
        'GET',
        '/hours/wt',
        { query: queryParams },
        queryKeys.hours.wt(escId ?? 0, queryParams),
    )

    const chartData = data?.tripulantes ?? []
    const startDate = data?.startDate
    const endDate = data?.endDate
    const errorMsg = queryError
        ? (queryError instanceof Error ? queryError.message : 'Error al obtener los datos')
        : undefined

    // Traduce el rango emitido por el selector al estado de rango del backend.
    const handleDateRangeChange = useCallback((params: StatsParams) => {
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
    }, [])

    return { loading, errorMsg, chartData, startDate, endDate, handleDateRangeChange }
}
