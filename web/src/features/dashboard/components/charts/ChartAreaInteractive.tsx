"use client"

import type { ReactNode } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
    ChartTooltipContent,
} from "@/components/ui/chart.tsx"

import { ChartDataPoint } from "@/types/dashboard.ts"

interface ChartAreaInteractiveProps {
    jsonData: ChartDataPoint[];
    fechaInicio?: string;
    fechaFin?: string;
}

const chartConfig = {
    simulador: {
        label: "Simulador",
        color: "var(--chart-1)",
    },
    real: {
        label: "Real",
        color: "var(--chart-2)",
    },
} satisfies ChartConfig

// Opciones de formato reutilizables (evita recrear objetos en cada render)
const DATE_FORMAT_SHORT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
const DATE_FORMAT_FULL: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }

// Formatters estables fuera del componente (referencia estable para recharts)
const xAxisTickFormatter = (value: string) => {
    const date = new Date(value)
    return date.toLocaleDateString("es-ES", DATE_FORMAT_SHORT)
}

const tooltipLabelFormatter = (value: ReactNode) => {
    if (typeof value !== 'string') return value
    return new Date(value).toLocaleDateString("es-ES", DATE_FORMAT_FULL)
}

// Domain como constante para evitar recreación
const yAxisDomain: [number, (dataMax: number) => number] = [0, (dataMax) => Math.ceil(dataMax * 1.1)]

function generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];

    const startStr = startDate.split('T')[0];
    const endStr = endDate.split('T')[0];

    const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endStr.split('-').map(Number);

    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    while (current <= end) {
        const year = current.getUTCFullYear();
        const month = String(current.getUTCMonth() + 1).padStart(2, '0');
        const day = String(current.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);

        current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
}

function normalizeDateToString(dateInput: string | Date): string {
    const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
    const datePart = dateStr.split('T')[0];
    return datePart;
}

function fillMissingDates(
    data: ChartDataPoint[],
    fechaInicio?: string,
    fechaFin?: string
): ChartDataPoint[] {
    if (!fechaInicio || !fechaFin) {
        return data;
    }

    const dataMap = new Map<string, ChartDataPoint>();
    data.forEach(point => {
        const dateKey = normalizeDateToString(point.date);
        dataMap.set(dateKey, point);
    });

    const allDates = generateDateRange(fechaInicio, fechaFin);

    return allDates.map(date => {
        if (dataMap.has(date)) {
            return dataMap.get(date)!;
        }
        return {
            date: date,
            real: 0,
            simulador: 0,
        };
    });
}

export function ChartAreaInteractive({ jsonData, fechaInicio, fechaFin }: ChartAreaInteractiveProps) {

    const filledData = fillMissingDates(jsonData, fechaInicio, fechaFin);

    return (
        <Card className="pt-0">
            <CardHeader className="py-5">
                <CardTitle className="text-base text-foreground">Evolución Temporal de Horas de Vuelo</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={filledData}>
                        <defs>
                            <linearGradient id="fillSimulador" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--chart-2)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--chart-2)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                            <linearGradient id="fillReal" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--chart-1)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--chart-1)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={20}
                            minTickGap={32}
                            tickFormatter={xAxisTickFormatter}
                        />
                        <YAxis hide domain={yAxisDomain} />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={tooltipLabelFormatter}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="real"
                            type="natural"
                            fill="url(#fillReal)"
                            stroke="var(--chart-1)"
                        />
                        <Area
                            dataKey="simulador"
                            type="natural"
                            fill="url(#fillSimulador)"
                            stroke="var(--chart-2)"
                        />

                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
