// src/components/ui/ChartPieEscuadrillaTotalPersons.tsx
"use client"

import { Label, Pie, PieChart } from "recharts"

import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import { PersonalTotalStats } from "@/types/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface ChartPieEscuadrillaTotalPersonsProps {
    data?: PersonalTotalStats;
    loading?: boolean;
}

const chartConfig = {
    cantidad: {
        label: "Cantidad",
    },
    oficiales: {
        label: "Oficiales",
        color: "var(--chart-gray-1)",
    },
    suboficiales: {
        label: "Suboficiales",
        color: "var(--chart-gray-2)",
    },
    tropaymarineria: {
        label: "Tropa/Marinería",
        color: "var(--chart-gray-3)",
    },
} satisfies ChartConfig

export function ChartPieEscuadrillaTotalPersons({ data, loading }: ChartPieEscuadrillaTotalPersonsProps) {
    const chartData = !data ? [] : [
        { categoria: "oficiales", cantidad: data.oficiales, fill: "var(--color-oficiales)" },
        { categoria: "suboficiales", cantidad: data.suboficiales, fill: "var(--color-suboficiales)" },
        { categoria: "tropaymarineria", cantidad: data.tropa_marineria, fill: "var(--color-tropaymarineria)" },
    ]

    const total = data?.total ?? 0

    if (loading) {
        return (
            <Card className="flex flex-col w-full h-full">
                <CardContent className="flex-1 p-0 flex items-center justify-center">
                    <Skeleton className="aspect-square w-3/4 max-w-[140px] rounded-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="flex flex-col w-full h-full overflow-hidden">
            <CardContent className="flex-1 p-1 min-h-0 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full min-w-[100px] min-h-[100px]">
                    <ChartContainer
                        config={chartConfig}
                        className="w-full h-full !aspect-auto"
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        hideLabel
                                        className="min-w-[180px] text-sm"
                                    />
                                }
                            />
                            <Pie
                                data={chartData}
                                dataKey="cantidad"
                                nameKey="categoria"
                                innerRadius="55%"
                                outerRadius="85%"
                                strokeWidth={2}
                                cx="50%"
                                cy="50%"
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy - 8}
                                                        className="fill-foreground text-xl sm:text-2xl font-bold"
                                                    >
                                                        {total.toLocaleString()}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 12}
                                                        className="fill-muted-foreground text-[10px] sm:text-xs"
                                                    >
                                                        Efectivos
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    )
}