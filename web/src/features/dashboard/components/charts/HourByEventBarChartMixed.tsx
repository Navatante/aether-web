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
import { HorasPorEventoLugar } from "@/types/dashboard.ts"

interface BarChartMixedProps {
    data?: HorasPorEventoLugar[]
}

interface ChartDataItem {
    evento: string
    total: number
    lugares: { lugar: string; horas: number }[]
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
            <p className="font-medium text-sm mb-2">{data.evento}</p>
            <div className="bg-muted px-2 py-1.5 rounded mb-2">
                <p className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium tabular-nums">{(data.total ?? 0).toFixed(1)}h</span>
                </p>
            </div>
            {data.lugares.length > 0 && (
                <div className="space-y-1">
                    {data.lugares.map(({ lugar, horas }) => (
                        <div key={lugar} className="text-sm flex justify-between">
                            <span className="text-muted-foreground">{lugar}</span>
                            <span className="tabular-nums">{(horas ?? 0).toFixed(1)}h</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function HourByEventBarChartMixed({ data = [] }: BarChartMixedProps) {
    const chartData: ChartDataItem[] = (() => {
        if (!data || data.length === 0) return []

        const validData = data.filter(item => {
            if (!item || typeof item !== 'object') return false
            if (!item.evento) return false
            if (!item.lugares || typeof item.lugares !== 'object') return false
            return true
        })

        if (validData.length === 0) return []

        const transformedData = validData.map(item => {
            const lugares: { lugar: string; horas: number }[] = []
            let total = 0

            Object.entries(item.lugares).forEach(([lugar, horas]) => {
                const horasNum = horas || 0
                if (horasNum > 0) {
                    lugares.push({ lugar, horas: horasNum })
                    total += horasNum
                }
            })

            lugares.sort((a, b) => b.horas - a.horas)

            return {
                evento: item.evento,
                total,
                lugares,
            }
        })

        return transformedData.sort((a, b) => b.total - a.total)
    })()

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-medium text-foreground">Horas por Evento</CardTitle>
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
                <CardTitle className="text-base font-medium text-foreground">Horas por Evento</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 0, right: 16 }}
                    >
                        <YAxis
                            dataKey="evento"
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
