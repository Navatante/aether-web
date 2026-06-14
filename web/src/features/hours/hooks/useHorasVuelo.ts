import { useCallback, useMemo, useState } from 'react'
import { useApiQuery } from '@/lib/apiQuery'
import { queryKeys } from '@/lib/queryKeys'
import { useEscuadrilla } from '@/providers'
import type { EnrichedTripulanteData, TripulantesResponse } from '@/types/hours'
import type { PredefinedRange, StatsParams } from '@/shared/components/common'

export interface UseHorasVueloOptions {
    /** Rol de persona a consultar (filtro del backend). Por defecto 'Piloto'. */
    personRol?: string
    /** Rango predefinido inicial; debe coincidir con el default del selector. */
    initialTimeRange?: PredefinedRange
    /** Modo "Totales": suma las horas de arrastre (operations.previous_hour). */
    includePrevious?: boolean
}

export interface UseHorasVueloResult {
    loading: boolean
    errorMsg: string | undefined
    /** Datos crudos del SP. */
    chartData: TripulantesResponse['tripulantes']
    /** Datos enriquecidos con total_all (Día + Noche + GVN). */
    enrichedChartData: EnrichedTripulanteData[]
    startDate: string | undefined
    endDate: string | undefined
    /** Handler para el `onDataReceived` de SegmentedDateRangeAether. */
    handleDateRangeChange: (params: StatsParams) => void
}

/**
 * Lógica de la vista de horas de vuelo por periodo (sp_get_personNH90PeriodHours):
 * estado del rango, consulta a `/hours/nh90-period` vía TanStack Query y
 * enriquecido de datos. La página solo renderiza el resultado.
 */
export function useHorasVuelo(options: UseHorasVueloOptions = {}): UseHorasVueloResult {
    const { personRol = 'Piloto', initialTimeRange = 'ultimos-30-dias', includePrevious = false } = options
    const { id: escId } = useEscuadrilla()

    // Solo el rango es estado mutable (lo cambia el selector). El resto de params
    // (rol, modo Totales) son props y se mezclan en cada render. El estado inicial
    // se alinea con el default del selector para evitar un fetch extra en el montaje.
    const [rangeParams, setRangeParams] = useState<Record<string, string | undefined>>({
        time_range: initialTimeRange,
    })

    // Al cambiar cualquier param, TanStack Query refetchea (la queryKey los incluye).
    // El modo "Totales" (arrastre vitalicio) solo tiene sentido con el rango completo,
    // así que fuerza "historico" e ignora el rango del selector.
    const queryParams = useMemo<Record<string, string | undefined>>(() => {
        if (includePrevious) {
            return { person_rol: personRol, include_previous: 'true', time_range: 'historico' }
        }
        return { person_rol: personRol, ...rangeParams }
    }, [personRol, includePrevious, rangeParams])

    const {
        data,
        isFetching: loading,
        error: queryError,
    } = useApiQuery<TripulantesResponse>(
        'GET',
        '/hours/nh90-period',
        { query: queryParams },
        queryKeys.hours.pilotos(escId ?? 0, queryParams),
    )

    const chartData = data?.tripulantes ?? []
    const startDate = data?.startDate
    const endDate = data?.endDate
    const errorMsg = queryError
        ? (queryError instanceof Error ? queryError.message : 'Error al obtener los datos')
        : undefined

    const enrichedChartData = useMemo<EnrichedTripulanteData[]>(
        () => chartData.map(d => ({
            ...d,
            total_all: d.total_day_hour_qty + d.total_night_hour_qty + d.total_gvn_hour_qty,
        })),
        [chartData],
    )

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

    return { loading, errorMsg, chartData, enrichedChartData, startDate, endDate, handleDateRangeChange }
}
