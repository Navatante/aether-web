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

interface CapbaData {
    capba: string
    horas: number
}

interface HourByCapbaBarChartProps {
    data?: CapbaData[]
}

interface ChartDataItem {
    capba: string
    horas: number
}

const chartConfig = {
    horas: {
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
            <p className="font-medium text-sm mb-2">{data.capba}</p>
            <div className="bg-muted px-2 py-1.5 rounded">
                <p className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium tabular-nums">{(data.horas ?? 0).toFixed(1)}h</span>
                </p>
            </div>
        </div>
    )
}

export default function HourByCapbaBarChart({ data = [] }: HourByCapbaBarChartProps) {
    const chartData: ChartDataItem[] = (() => {
        if (!data || data.length === 0) return []

        const validData = data.filter(item => {
            if (!item || typeof item !== 'object') return false
            if (!item.capba) return false
            if (typeof item.horas !== 'number' || item.horas <= 0) return false
            return true
        })

        if (validData.length === 0) return []

        return validData
            .map(item => ({
                capba: item.capba,
                horas: item.horas,
            }))
            .sort((a, b) => b.horas - a.horas)
    })()

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-medium text-foreground">Horas por Capacidad Básica</CardTitle>
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
                <CardTitle className="text-base font-medium text-foreground">Horas por Capacidad Básica</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 0, right: 16 }}
                    >
                        <YAxis
                            dataKey="capba"
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
                            dataKey="horas"
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
