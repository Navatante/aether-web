"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card.tsx"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
} from "@/components/ui/chart.tsx"

export interface HorasPorPeriodo {
    dia_real: number
    dia_simulado: number
    noche_sin_gafas_real: number
    noche_sin_gafas_simulado: number
    gvn_real: number
    anvis_real: number
    iit_real: number
    gvn_simulado: number
    anvis_simulado: number
    iit_simulado: number
}

interface HourByPeriodBarChartProps {
    data?: HorasPorPeriodo | null
}

interface ChartDataItem {
    periodo: string
    total: number
    real: number
    simulado: number
    desglose?: { label: string; real: number; simulado: number }[]
}

const chartConfig = {
    total: {
        label: "Horas",
        color: "var(--chart-1)",
    },
} satisfies ChartConfig

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
    if (!active || !payload?.length) return null

    const data = payload[0].payload
    if (!data) return null

    return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg min-w-[160px]">
            <p className="font-medium text-sm mb-2">{data.periodo}</p>
            <div className="bg-muted px-2 py-1.5 rounded mb-2">
                <p className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium tabular-nums">{(data.total ?? 0).toFixed(1)}h</span>
                </p>
            </div>
            <div className="space-y-1 mb-2">
                <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Real</span>
                    <span className="tabular-nums">{(data.real ?? 0).toFixed(1)}h</span>
                </div>
                <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Simulado</span>
                    <span className="tabular-nums">{(data.simulado ?? 0).toFixed(1)}h</span>
                </div>
            </div>
            {data.desglose && data.desglose.length > 0 && (
                <div className="border-t border-border pt-2 space-y-2">
                    {data.desglose.map(({ label, real, simulado }) => (
                        <div key={label}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                            <div className="pl-2 space-y-0.5">
                                <div className="text-sm flex justify-between">
                                    <span className="text-muted-foreground">Real</span>
                                    <span className="tabular-nums">{(real ?? 0).toFixed(1)}h</span>
                                </div>
                                <div className="text-sm flex justify-between">
                                    <span className="text-muted-foreground">Simulado</span>
                                    <span className="tabular-nums">{(simulado ?? 0).toFixed(1)}h</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function HourByPeriodBarChart({ data }: HourByPeriodBarChartProps) {
    const chartData: ChartDataItem[] = (() => {
        if (!data) return []

        const transformedData: ChartDataItem[] = [
            {
                periodo: "Día",
                real: data.dia_real || 0,
                simulado: data.dia_simulado || 0,
                total: (data.dia_real || 0) + (data.dia_simulado || 0),
            },
            {
                periodo: "Noche",
                real: data.noche_sin_gafas_real || 0,
                simulado: data.noche_sin_gafas_simulado || 0,
                total: (data.noche_sin_gafas_real || 0) + (data.noche_sin_gafas_simulado || 0),
            },
            {
                periodo: "GVN",
                real: data.gvn_real || 0,
                simulado: data.gvn_simulado || 0,
                total: (data.gvn_real || 0) + (data.gvn_simulado || 0),
                desglose: [
                    { label: "ANVIS", real: data.anvis_real || 0, simulado: data.anvis_simulado || 0 },
                    { label: "IIT", real: data.iit_real || 0, simulado: data.iit_simulado || 0 },
                ],
            },
        ]

        return transformedData
            .filter(item => item.total > 0)
            .sort((a, b) => b.total - a.total)
    })()

    if (!data || chartData.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-medium text-foreground">Horas por Periodo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                        No hay datos disponibles
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-foreground">Horas por Periodo</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 0, right: 16 }}
                    >
                        <YAxis
                            dataKey="periodo"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={120}
                            tick={{ fontSize: 14 }}
                        />
                        <XAxis
                            type="number"
                            hide
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<CustomTooltip />}
                        />
                        <Bar
                            dataKey="total"
                            fill="var(--chart-2)"
                            radius={4}
                            barSize={24}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
