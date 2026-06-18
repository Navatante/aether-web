import { useState } from 'react'
import ViewModeToggleNH90Totals from "../components/ViewModeToggleNH90Totals";
import NH90HoursChart from "../components/NH90HoursChart";
import FormationHoursChart from "../components/FormationHoursChart";
import GvntypeHoursChart from "../components/GvntypeHoursChart";
import IftHoursChart from "../components/IftHoursChart";
import InstructorHoursChart from "../components/InstructorHoursChart";
import CtaHoursChart from "../components/CtaHoursChart";
import { useHorasVuelo } from "../hooks/useHorasVuelo";
import { useHorasFormacion } from "../hooks/useHorasFormacion";
import { useHorasGvntype } from "../hooks/useHorasGvntype";
import { useHorasIft } from "../hooks/useHorasIft";
import { useHorasInstructor } from "../hooks/useHorasInstructor";
import { useHorasCta } from "../hooks/useHorasCta";
import { GradientTitle, SegmentedDateRangeAether } from "@/shared/components/common";
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
    } = useHorasVuelo({ personRol: 'Piloto', includeExtra: viewMode === 'totals' })

    const {
        loading: formacionLoading,
        errorMsg: formacionErrorMsg,
        chartData: formacionData,
        handleDateRangeChange: handleFormacionDateRangeChange,
    } = useHorasFormacion({ personRol: 'Piloto', includeExtra: viewMode === 'totals' })

    const {
        loading: gvntypeLoading,
        errorMsg: gvntypeErrorMsg,
        chartData: gvntypeData,
        handleDateRangeChange: handleGvntypeDateRangeChange,
    } = useHorasGvntype({ personRol: 'Piloto' })

    const {
        loading: iftLoading,
        errorMsg: iftErrorMsg,
        chartData: iftData,
        handleDateRangeChange: handleIftDateRangeChange,
    } = useHorasIft({ personRol: 'Piloto', includeExtra: viewMode === 'totals' })

    const {
        loading: instructorLoading,
        errorMsg: instructorErrorMsg,
        chartData: instructorData,
        handleDateRangeChange: handleInstructorDateRangeChange,
    } = useHorasInstructor({ personRol: 'Piloto' })

    const {
        loading: ctaLoading,
        errorMsg: ctaErrorMsg,
        chartData: ctaData,
        handleDateRangeChange: handleCtaDateRangeChange,
    } = useHorasCta({ personRol: 'Piloto', includeExtra: viewMode === 'totals' })

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
                    Alimenta tanto las horas NH-90 como las de formación. */}
                {viewMode === 'nh90' && (
                    <SegmentedDateRangeAether
                        onDataReceived={(params) => {
                            handleDateRangeChange(params)
                            handleFormacionDateRangeChange(params)
                            handleGvntypeDateRangeChange(params)
                            handleIftDateRangeChange(params)
                            handleInstructorDateRangeChange(params)
                            handleCtaDateRangeChange(params)
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

                {/* Horas de vuelo en formación: una línea de Día y otra de GVN.
                    En Totales cruza escuadrillas (persona que cambió de escuadrilla). */}
                <StatsChartCard
                    title={viewMode === 'totals' ? 'Horas de vuelo en Formación (Totales)' : 'Horas de vuelo en Formación'}
                    isLoading={formacionLoading}
                    error={formacionErrorMsg}
                    isEmpty={formacionData.length === 0}
                >
                    <FormationHoursChart data={formacionData} />
                </StatsChartCard>

                {/* Horas por tipo de gafas de visión nocturna: IIT y ANVIS.
                    Solo en la vista NH-90 (Totales no tiene rango de fechas). */}
                {viewMode === 'nh90' && (
                    <StatsChartCard
                        title="Horas de vuelo GVN por tipo (IIT / ANVIS)"
                        isLoading={gvntypeLoading}
                        error={gvntypeErrorMsg}
                        isEmpty={gvntypeData.length === 0}
                    >
                        <GvntypeHoursChart data={gvntypeData} />
                    </StatsChartCard>
                )}

                {/* Horas de vuelo por instrumentos (operations.ift_hour). En Totales
                    cruza escuadrillas y suma el arrastre (extra_hours_inst). */}
                <StatsChartCard
                    title={viewMode === 'totals' ? 'Horas de vuelo por Instrumentos (Totales)' : 'Horas de vuelo por Instrumentos'}
                    isLoading={iftLoading}
                    error={iftErrorMsg}
                    isEmpty={iftData.length === 0}
                >
                    <IftHoursChart data={iftData} />
                </StatsChartCard>

                {/* Horas de vuelo como instructor (operations.instructor_hour).
                    Solo en la vista NH-90 (Totales no tiene rango de fechas). */}
                {viewMode === 'nh90' && (
                    <StatsChartCard
                        title="Horas de vuelo como Instructor"
                        isLoading={instructorLoading}
                        error={instructorErrorMsg}
                        isEmpty={instructorData.length === 0}
                    >
                        <InstructorHoursChart data={instructorData} />
                    </StatsChartCard>
                )}

                {/* Horas como Comandante de Aeronave (CTA). Suma vuelos en Aether
                    (como CTA) + horas CTA de modelos anteriores; ver la query
                    CtaHours. En Totales cruza escuadrillas y suma el arrastre
                    (extra_hours_cta). */}
                <StatsChartCard
                    title={viewMode === 'totals' ? 'Horas como Comandante de Aeronave (Totales)' : 'Horas como Comandante de Aeronave'}
                    isLoading={ctaLoading}
                    error={ctaErrorMsg}
                    isEmpty={ctaData.length === 0}
                >
                    <CtaHoursChart data={ctaData} />
                </StatsChartCard>
            </div>
        </div>
    )
}
