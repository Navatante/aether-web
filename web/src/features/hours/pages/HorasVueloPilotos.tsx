import { useState } from 'react'
import ViewModeToggleNH90Totals from "../components/ViewModeToggleNH90Totals";
import NH90HoursChart from "../components/NH90HoursChart";
import { useHorasVuelo } from "../hooks/useHorasVuelo";
import { GradientTitle, SegmentedDateRangeAether, formatDateDisplay } from "@/shared/components/common";
import { StatsChartCard } from "@/shared/components/charts";

export default function HorasVueloPilotos() {
    const [viewMode, setViewMode] = useState<'nh90' | 'totals'>('nh90')
    const {
        loading,
        errorMsg,
        chartData,
        enrichedChartData,
        startDate,
        endDate,
        handleDateRangeChange,
    } = useHorasVuelo({ personRol: 'Piloto', includePrevious: viewMode === 'totals' })

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

                {/* Selector de rango: solo en NH-90. "Totales" usa siempre el histórico. */}
                {viewMode === 'nh90' && (
                    <SegmentedDateRangeAether
                        onDataReceived={handleDateRangeChange}
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
            </div>
        </div>
    )
}
