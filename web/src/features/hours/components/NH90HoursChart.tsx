import { Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartTooltip,
} from "@/components/ui/chart"
import type { EnrichedTripulanteData } from "@/types/hours"

// Configuración del gráfico: mismo color por periodo (Día/Noche/GVN), Real vs Sim
// se distinguen por opacidad. El color lo inyecta ChartContainer como --color-<key>.
const chartConfig = {
    // Real group
    real_day_hour_qty:   { label: "Día (Real)",   color: "var(--color-day-hour)" },
    real_night_hour_qty: { label: "Noche (Real)", color: "var(--color-night-hour)" },
    real_gvn_hour_qty:   { label: "GVN (Real)",   color: "var(--color-gvn-hour)" },
    // Sim group
    sim_day_hour_qty:    { label: "Día (Sim)",    color: "var(--color-day-hour)" },
    sim_night_hour_qty:  { label: "Noche (Sim)",  color: "var(--color-night-hour)" },
    sim_gvn_hour_qty:    { label: "GVN (Sim)",    color: "var(--color-gvn-hour)" },
    // Total line
    total_all:           { label: "Total",        color: "var(--foreground)" },
} satisfies ChartConfig

// Leyenda personalizada (la auto-leyenda mostraría 7 entradas redundantes).
function CustomLegend() {
    return (
        <div className="flex flex-col items-center gap-2 pt-3">
            {/* Fila 1: Colores Día/Noche/GVN */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px]"
                         style={{ backgroundColor: "var(--color-day-hour)" }} />
                    <span className="text-xs text-muted-foreground">Día</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px]"
                         style={{ backgroundColor: "var(--color-night-hour)" }} />
                    <span className="text-xs text-muted-foreground">Noche</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px]"
                         style={{ backgroundColor: "var(--color-gvn-hour)" }} />
                    <span className="text-xs text-muted-foreground">GVN</span>
                </div>
            </div>
            {/* Fila 2: Real (sólido) / Sim (transparente) / Total (línea) */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-6 rounded-[2px] bg-foreground/80" />
                    <span className="text-xs text-muted-foreground">Real</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-6 rounded-[2px] bg-foreground/30" />
                    <span className="text-xs text-muted-foreground">Simulado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex items-center h-2.5 w-6">
                        <div className="w-full h-[2px] bg-foreground/70 rounded" />
                    </div>
                    <span className="text-xs text-muted-foreground">Total</span>
                </div>
            </div>
        </div>
    );
}

interface NH90HoursChartProps {
    data: EnrichedTripulanteData[]
}

/**
 * Gráfico de horas de vuelo NH90: barras apiladas Real (opaco) + Sim (semi)
 * por periodo Día/Noche/GVN, más una línea de total por tripulante.
 */
export default function NH90HoursChart({ data }: NH90HoursChartProps) {
    return (
        <div className="overflow-x-auto">
            <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: '400px', minWidth: `${Math.max(800, data.length * 100)}px` }}
            >
                <ComposedChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    barGap={1}
                    barCategoryGap="20%"
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="person_nk"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        fontSize={12}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}h`}
                        fontSize={12}
                    />
                    <ChartTooltip
                        cursor={false}
                        wrapperStyle={{ zIndex: 50 }}
                        content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;

                            const d = payload[0].payload as EnrichedTripulanteData;

                            const periods = [
                                {
                                    label: "Día",
                                    real: d.real_day_hour_qty,
                                    sim: d.sim_day_hour_qty,
                                    total: d.total_day_hour_qty,
                                    color: "var(--color-day-hour)",
                                },
                                {
                                    label: "Noche",
                                    real: d.real_night_hour_qty,
                                    sim: d.sim_night_hour_qty,
                                    total: d.total_night_hour_qty,
                                    color: "var(--color-night-hour)",
                                },
                                {
                                    label: "GVN",
                                    real: d.real_gvn_hour_qty,
                                    sim: d.sim_gvn_hour_qty,
                                    total: d.total_gvn_hour_qty,
                                    color: "var(--color-gvn-hour)",
                                },
                            ];

                            return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[220px]">
                                    {/* Nombre del piloto */}
                                    <div className="mb-2 pb-1.5 border-b">
                                        <span className="text-sm font-semibold text-foreground">
                                            {d.person_nk}
                                        </span>
                                    </div>

                                    {/* Períodos */}
                                    <div className="space-y-3">
                                        {periods.map((period) => (
                                            <div key={period.label}>
                                                {/* Encabezado del período */}
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                                        style={{ backgroundColor: period.color }}
                                                    />
                                                    <span className="text-sm font-medium">
                                                        {period.label}
                                                    </span>
                                                    <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
                                                        {(period.total ?? 0).toFixed(1)}
                                                        <span className="text-muted-foreground font-normal">h</span>
                                                     </span>
                                                </div>

                                                {/* Desglose */}
                                                <div className="ml-[18px] mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                    <div className="flex justify-between">
                                                        <span>Real</span>
                                                        <span className="font-mono tabular-nums">
                                                            {(period.real ?? 0).toFixed(1)}h
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Simulador</span>
                                                        <span className="font-mono tabular-nums">
                                                            {(period.sim ?? 0).toFixed(1)}h
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totales */}
                                    <div className="mt-3 pt-2 border-t space-y-1">
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <span>Total Real</span>
                                            <span className="ml-auto font-mono tabular-nums">
                                                {((d.real_day_hour_qty ?? 0) + (d.real_night_hour_qty ?? 0) + (d.real_gvn_hour_qty ?? 0)).toFixed(1)}
                                                <span className="font-normal">h</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <span>Total Simulado</span>
                                            <span className="ml-auto font-mono tabular-nums">
                                                {((d.sim_day_hour_qty ?? 0) + (d.sim_night_hour_qty ?? 0) + (d.sim_gvn_hour_qty ?? 0)).toFixed(1)}
                                                <span className="font-normal">h</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center text-sm font-semibold">
                                            <span>Total</span>
                                            <span className="ml-auto font-mono tabular-nums">
                                                {(d.total_all ?? 0).toFixed(1)}
                                                <span className="text-muted-foreground font-normal">h</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />
                    <ChartLegend content={<CustomLegend />} />

                    {/* REAL stack (full opacity) */}
                    <Bar
                        dataKey="real_day_hour_qty"
                        stackId="real"
                        fill="var(--color-real_day_hour_qty)"
                        fillOpacity={1.0}
                        radius={[0, 0, 4, 4]}
                    />
                    <Bar
                        dataKey="real_night_hour_qty"
                        stackId="real"
                        fill="var(--color-real_night_hour_qty)"
                        fillOpacity={1.0}
                        radius={[0, 0, 0, 0]}
                    />
                    <Bar
                        dataKey="real_gvn_hour_qty"
                        stackId="real"
                        fill="var(--color-real_gvn_hour_qty)"
                        fillOpacity={1.0}
                        radius={[4, 4, 0, 0]}
                    />

                    {/* SIM stack (semi-transparent) */}
                    <Bar
                        dataKey="sim_day_hour_qty"
                        stackId="sim"
                        fill="var(--color-sim_day_hour_qty)"
                        fillOpacity={0.5}
                        radius={[0, 0, 4, 4]}
                    />
                    <Bar
                        dataKey="sim_night_hour_qty"
                        stackId="sim"
                        fill="var(--color-sim_night_hour_qty)"
                        fillOpacity={0.5}
                        radius={[0, 0, 0, 0]}
                    />
                    <Bar
                        dataKey="sim_gvn_hour_qty"
                        stackId="sim"
                        fill="var(--color-sim_gvn_hour_qty)"
                        fillOpacity={0.5}
                        radius={[4, 4, 0, 0]}
                    />

                    {/* TOTAL line */}
                    <Line
                        type="linear"
                        dataKey="total_all"
                        stroke="var(--color-total_all)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-total_all)", r: 3, strokeWidth: 0 }}
                        strokeOpacity={0.7}
                        connectNulls
                    />
                </ComposedChart>
            </ChartContainer>
        </div>
    )
}
