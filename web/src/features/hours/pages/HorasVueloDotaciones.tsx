import { useState } from 'react'
import ViewModeToggleNH90Totals from "../components/ViewModeToggleNH90Totals";
import NH90HoursChart from "../components/NH90HoursChart";
import WtHoursChart from "../components/WtHoursChart";
import { useHorasVuelo } from "../hooks/useHorasVuelo";
import { useHorasWt } from "../hooks/useHorasWt";
import { GradientTitle, SegmentedDateRangeAether } from "@/shared/components/common";
import { StatsChartCard } from "@/shared/components/charts";

// Roles que componen las dotaciones (mismo filtro que adiestramiento/instrucción
// de dotaciones). El backend recibe el rol como CSV en `person_rol`.
const DOTACION_ROLES = 'Dotación,Dotación/Nadador'

export default function HorasVueloDotaciones() {
    const [viewMode, setViewMode] = useState<'nh90' | 'totals'>('nh90')

    const {
        loading,
        errorMsg,
        chartData,
        enrichedChartData,
        startDate,
        endDate,
        handleDateRangeChange,
    } = useHorasVuelo({ personRol: DOTACION_ROLES, includeExtra: viewMode === 'totals' })

    const {
        loading: wtLoading,
        errorMsg: wtErrorMsg,
        chartData: wtData,
        handleDateRangeChange: handleWtDateRangeChange,
    } = useHorasWt({ personRol: DOTACION_ROLES })

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-3 mb-4">
                    <GradientTitle>Horas de vuelo</GradientTitle>
                </div>
            </div>

            <div className="w-full space-y-4 p-4">
                {/* Selector de vista */}
                <ViewModeToggleNH90Totals
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />

                {/* Selector de rango: solo en NH-90. "Totales" usa siempre el histórico.
                    Alimenta tanto las horas NH-90 como las de Winch Trim. */}
                {viewMode === 'nh90' && (
                    <SegmentedDateRangeAether
                        onDataReceived={(params) => {
                            handleDateRangeChange(params)
                            handleWtDateRangeChange(params)
                        }}
                        currentDateFrom={startDate}
                        currentDateTo={endDate}
                    />
                )}

                <StatsChartCard
                    title={viewMode === 'totals' ? 'Horas de vuelo totales' : 'Horas de vuelo NH-90'}
                    isLoading={loading}
                    error={errorMsg}
                    isEmpty={chartData.length === 0}
                >
                    <NH90HoursChart data={enrichedChartData} />
                </StatsChartCard>

                {/* Horas de Winch Trim (operations.wt_hour). Solo en la vista NH-90:
                    el modo "Totales" no incluye las horas de Winch Trim. */}
                {viewMode === 'nh90' && (
                    <StatsChartCard
                        title="Horas de vuelo Winch Trim"
                        isLoading={wtLoading}
                        error={wtErrorMsg}
                        isEmpty={wtData.length === 0}
                    >
                        <WtHoursChart data={wtData} />
                    </StatsChartCard>
                )}
            </div>
        </div>
    )
}
