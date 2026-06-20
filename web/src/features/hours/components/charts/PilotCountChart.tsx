import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

/** Una serie (línea) del gráfico: campo del dato, etiqueta y color (token). */
export interface CountSeries {
    /** Clave del campo en los datos (p. ej. "tierra_day_qty"). */
    key: string
    /** Etiqueta en leyenda/tooltip (p. ej. "Día"). */
    label: string
    /** Color como token CSS (p. ej. "var(--color-day-hour)"). */
    color: string
}

interface PilotCountChartProps<T> {
    /** Una fila por piloto; debe incluir `person_nk` y las claves de `series`. */
    data: T[]
    /** Las 2-3 líneas a pintar. */
    series: CountSeries[]
}

/**
 * Gráfico horizontal de recuentos por piloto: `person_nk` en el eje X (categórico),
 * cantidad en el eje Y (numérico), una línea por serie (periodos o tipos).
 * Reutilizable para los 6 gráficos de tomas/aproximaciones.
 */
export default function PilotCountChart<T extends { person_nk: string }>({
    data,
    series,
}: PilotCountChartProps<T>) {
    // El color lo inyecta ChartContainer como --color-<key> a partir del config.
    const chartConfig = Object.fromEntries(
        series.map((s) => [s.key, { label: s.label, color: s.color }]),
    ) satisfies ChartConfig

    // Ancho mínimo según nº de pilotos: si no caben, la tarjeta scrollea en X.
    const minWidth = Math.max(420, data.length * 42)

    return (
        <div className="overflow-x-auto">
            <ChartContainer config={chartConfig} className="w-full" style={{ height: "320px", minWidth: `${minWidth}px` }}>
                <LineChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="person_nk"
                        type="category"
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={56}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                    />
                    <YAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Legend />
                    {series.map((s) => (
                        <Line
                            key={s.key}
                            type="linear"
                            dataKey={s.key}
                            name={s.label}
                            stroke={`var(--color-${s.key})`}
                            strokeWidth={2}
                            dot={{ fill: `var(--color-${s.key})`, r: 3, strokeWidth: 0 }}
                            activeDot={{ r: 4 }}
                        />
                    ))}
                </LineChart>
            </ChartContainer>
        </div>
    )
}
