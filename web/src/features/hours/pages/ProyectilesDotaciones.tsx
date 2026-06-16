import PilotCountChart, { type CountSeries } from "../components/charts/PilotCountChart";
import { useProyectiles } from "../hooks/useProyectiles";
import { GradientTitle, SegmentedDateRangeAether, formatDateDisplay } from "@/shared/components/common";
import { StatsChartCard } from "@/shared/components/charts";

// Un único gráfico con dos líneas: M3M (7.62) y MAG58 (12.7).
const SERIES: CountSeries[] = [
    { key: "m3m_qty", label: "M3M", color: "var(--chart-1)" },
    { key: "mag58_qty", label: "MAG58", color: "var(--chart-accent)" },
];

export default function ProyectilesDotaciones() {
    const { loading, errorMsg, data, startDate, endDate, handleDateRangeChange } = useProyectiles();

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-3 mb-4">
                    <GradientTitle>Proyectiles</GradientTitle>
                </div>
            </div>

            <div className="w-full space-y-4 p-4">
                <SegmentedDateRangeAether
                    onDataReceived={handleDateRangeChange}
                    currentDateFrom={startDate}
                    currentDateTo={endDate}
                />

                <StatsChartCard
                    title="Proyectiles disparados"
                    isLoading={loading}
                    error={errorMsg}
                    isEmpty={data.length === 0}
                    stateHeight={320}
                >
                    <PilotCountChart data={data} series={SERIES} />
                </StatsChartCard>
            </div>
        </div>
    );
}
