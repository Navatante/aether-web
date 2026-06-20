import { useState } from 'react'
import { useApiQuery } from '@/lib/apiQuery'
import { queryKeys } from '@/lib/queryKeys'
import { useEscuadrilla } from '@/providers'
import type { InstructorResponse } from '@/types/hours'
import type { PredefinedRange, StatsParams } from '@/shared/components/common'

export interface UseHorasInstructorOptions {
    /** Rol de persona a consultar (filtro del backend). Por defecto 'Piloto'. */
    personRol?: string
    /** Rango predefinido inicial; debe coincidir con el default del selector. */
    initialTimeRange?: PredefinedRange
}

export interface UseHorasInstructorResult {
    loading: boolean
    errorMsg: string | undefined
    /** Horas como instructor por persona. */
    chartData: InstructorResponse['tripulantes']
    startDate: string | undefined
    endDate: string | undefined
    /** Handler para el `onDataReceived` de SegmentedDateRangeAether. */
    handleDateRangeChange: (params: StatsParams) => void
}

/**
 * Lógica de la vista de horas como instructor (operations.instructor_hour):
 * estado del rango, consulta a `/hours/instructor` vía TanStack Query.
 * La página solo renderiza.
 */
export function useHorasInstructor(options: UseHorasInstructorOptions = {}): UseHorasInstructorResult {
    const { personRol = 'Piloto', initialTimeRange = 'ultimos-30-dias' } = options
    const { id: escId } = useEscuadrilla()

    // Solo el rango es estado mutable (lo cambia el selector). El estado inicial se
    // alinea con el default del selector para evitar un fetch extra en el montaje.
    const [rangeParams, setRangeParams] = useState<Record<string, string | undefined>>({
        time_range: initialTimeRange,
    })

    const queryParams: Record<string, string | undefined> = { person_rol: personRol, ...rangeParams }

    const {
        data,
        isFetching: loading,
        error: queryError,
    } = useApiQuery<InstructorResponse>(
        'GET',
        '/hours/instructor',
        { query: queryParams },
        queryKeys.hours.instructor(escId ?? 0, queryParams),
    )

    const chartData = data?.tripulantes ?? []
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

    return { loading, errorMsg, chartData, startDate, endDate, handleDateRangeChange }
}
