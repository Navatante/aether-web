import PilotCountChart, { type CountSeries } from "../components/charts/PilotCountChart";
import { useTomasAproximaciones } from "../hooks/useTomasAproximaciones";
import { GradientTitle, SegmentedDateRangeAether } from "@/shared/components/common";
import { StatsChartCard } from "@/shared/components/charts";

// Los 6 gráficos: tomas por lugar (3 periodos cada uno) + aproximaciones (2 tipos cada uno).
// Periodos Día/Noche/GVN comparten los tokens de horas; las aproximaciones usan --chart-*.
const CHARTS: { title: string; series: CountSeries[] }[] = [
    {
        title: "Tomas en Tierra",
        series: [
            { key: "tierra_day_qty", label: "Día", color: "var(--color-day-hour)" },
            { key: "tierra_night_qty", label: "Noche", color: "var(--color-night-hour)" },
            { key: "tierra_gvn_qty", label: "GVN", color: "var(--color-gvn-hour)" },
        ],
    },
    {
        title: "Tomas en Monospot",
        series: [
            { key: "mono_day_qty", label: "Día", color: "var(--color-day-hour)" },
            { key: "mono_night_qty", label: "Noche", color: "var(--color-night-hour)" },
            { key: "mono_gvn_qty", label: "GVN", color: "var(--color-gvn-hour)" },
        ],
    },
    {
        title: "Tomas en Multispot",
        series: [
            { key: "multi_day_qty", label: "Día", color: "var(--color-day-hour)" },
            { key: "multi_night_qty", label: "Noche", color: "var(--color-night-hour)" },
            { key: "multi_gvn_qty", label: "GVN", color: "var(--color-gvn-hour)" },
        ],
    },
    {
        title: "Tomas en Carrier",
        series: [
            { key: "carrier_day_qty", label: "Día", color: "var(--color-day-hour)" },
            { key: "carrier_night_qty", label: "Noche", color: "var(--color-night-hour)" },
            { key: "carrier_gvn_qty", label: "GVN", color: "var(--color-gvn-hour)" },
        ],
    },
    {
        title: "Aproximaciones Instrumentales",
        series: [
            { key: "app_precision_qty", label: "Precisión", color: "var(--chart-1)" },
            { key: "app_no_precision_qty", label: "No precisión", color: "var(--chart-accent)" },
        ],
    },
    {
        title: "Aproximaciones SAR",
        series: [
            { key: "app_transition_down_qty", label: "Transition Down", color: "var(--chart-1)" },
            { key: "app_search_pattern_qty", label: "Search Pattern", color: "var(--chart-accent)" },
        ],
    },
];

export default function TomasAproximacionesPilotos() {
    const { loading, errorMsg, data, startDate, endDate, handleDateRangeChange } =
        useTomasAproximaciones({ personRol: "Piloto" });

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-3 mb-4">
                    <GradientTitle>Tomas y aproximaciones</GradientTitle>
                </div>
            </div>

            <div className="w-full space-y-4 p-4">
                <SegmentedDateRangeAether
                    onDataReceived={handleDateRangeChange}
                    currentDateFrom={startDate}
                    currentDateTo={endDate}
                />

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {CHARTS.map((chart) => (
                        <StatsChartCard
                            key={chart.title}
                            title={chart.title}
                            isLoading={loading}
                            error={errorMsg}
                            isEmpty={data.length === 0}
                            stateHeight={320}
                        >
                            <PilotCountChart data={data} series={chart.series} />
                        </StatsChartCard>
                    ))}
                </div>
            </div>
        </div>
    );
}
