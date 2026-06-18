import { useCallback, useMemo, useState } from 'react'
import { useApiQuery } from '@/lib/apiQuery'
import { queryKeys } from '@/lib/queryKeys'
import { useEscuadrilla } from '@/providers'
import type { CtaResponse } from '@/types/hours'
import type { PredefinedRange, StatsParams } from '@/shared/components/common'

export interface UseHorasCtaOptions {
    /** Rol de persona a consultar (filtro del backend). Por defecto 'Piloto'. */
    personRol?: string
    /** Rango predefinido inicial; debe coincidir con el default del selector. */
    initialTimeRange?: PredefinedRange
    /** Modo "Totales": cruza escuadrillas, suma el arrastre (extra_hours_cta)
     *  y usa siempre el histórico, ignorando el rango del selector. */
    includeExtra?: boolean
}

export interface UseHorasCtaResult {
    loading: boolean
    errorMsg: string | undefined
    /** Horas como Comandante de Aeronave por persona. */
    chartData: CtaResponse['tripulantes']
    startDate: string | undefined
    endDate: string | undefined
    /** Handler para el `onDataReceived` de SegmentedDateRangeAether. */
    handleDateRangeChange: (params: StatsParams) => void
}

/**
 * Lógica de la vista de horas como Comandante de Aeronave (CTA): estado del
 * rango, consulta a `/hours/cta` vía TanStack Query. La página solo renderiza.
 */
export function useHorasCta(options: UseHorasCtaOptions = {}): UseHorasCtaResult {
    const { personRol = 'Piloto', initialTimeRange = 'ultimos-30-dias', includeExtra = false } = options
    const { id: escId } = useEscuadrilla()

    // Solo el rango es estado mutable (lo cambia el selector). El estado inicial se
    // alinea con el default del selector para evitar un fetch extra en el montaje.
    const [rangeParams, setRangeParams] = useState<Record<string, string | undefined>>({
        time_range: initialTimeRange,
    })

    // El modo "Totales" cruza escuadrillas y solo tiene sentido con el histórico
    // completo, así que fuerza "historico" e ignora el rango del selector.
    const queryParams = useMemo<Record<string, string | undefined>>(() => {
        if (includeExtra) {
            return { person_rol: personRol, include_extra: 'true', time_range: 'historico' }
        }
        return { person_rol: personRol, ...rangeParams }
    }, [personRol, includeExtra, rangeParams])

    const {
        data,
        isFetching: loading,
        error: queryError,
    } = useApiQuery<CtaResponse>(
        'GET',
        '/hours/cta',
        { query: queryParams },
        queryKeys.hours.cta(escId ?? 0, queryParams),
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
