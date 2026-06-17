import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartTooltip,
} from "@/components/ui/chart"
import type { IftTripulanteData } from "@/types/hours"

// Una sola línea: horas por instrumentos, en blanco (--chart-1).
const chartConfig = {
    ift_hour_qty: { label: "Instrumentos", color: "var(--chart-1)" },
} satisfies ChartConfig

function CustomLegend() {
    return (
        <div className="flex items-center justify-center gap-4 pt-3">
            <div className="flex items-center gap-1.5">
                <div className="flex items-center h-2.5 w-6">
                    <div className="w-full h-[2px] rounded"
                         style={{ backgroundColor: "var(--chart-1)" }} />
                </div>
                <span className="text-xs text-muted-foreground">Instrumentos</span>
            </div>
        </div>
    );
}

interface IftHoursChartProps {
    data: IftTripulanteData[]
}

/**
 * Gráfico de líneas de horas de vuelo por instrumentos: una única línea por
 * tripulante. Recibe `data` por props (sin fetching).
 */
export default function IftHoursChart({ data }: IftHoursChartProps) {
    return (
        <div className="overflow-x-auto">
            <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: '400px', minWidth: `${Math.max(800, data.length * 100)}px` }}
            >
                <LineChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
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

                            const d = payload[0].payload as IftTripulanteData;

                            return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[200px]">
                                    <div className="mb-2 pb-1.5 border-b">
                                        <span className="text-sm font-semibold text-foreground">
                                            {d.person_nk}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                            style={{ backgroundColor: "var(--chart-1)" }}
                                        />
                                        <span className="text-sm font-medium">Instrumentos</span>
                                        <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
                                            {(d.ift_hour_qty ?? 0).toFixed(1)}
                                            <span className="text-muted-foreground font-normal">h</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        }}
                    />
                    <ChartLegend content={<CustomLegend />} />

                    <Line
                        type="linear"
                        dataKey="ift_hour_qty"
                        stroke="var(--color-ift_hour_qty)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-ift_hour_qty)", r: 3, strokeWidth: 0 }}
                        connectNulls
                    />
                </LineChart>
            </ChartContainer>
        </div>
    )
}
