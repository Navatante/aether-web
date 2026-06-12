"use client"

import { useState } from 'react'
import { useLogger } from '@/lib/logger'
import { Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartTooltip,
} from "@/components/ui/chart"
import ViewModeToggleNH90Totals from "../components/ViewModeToggleNH90Totals";
import { http } from "@/lib/http";
import { GradientTitle, SegmentedDateRangeAether, type StatsParams } from "@/shared/components/common";

// Interfaz para los datos del tripulante
interface TripulanteData {
    person_nk: string
    real_day_hour_qty: number
    sim_day_hour_qty: number
    total_day_hour_qty: number

    real_night_hour_qty: number
    sim_night_hour_qty: number
    total_night_hour_qty: number

    real_gvn_hour_qty: number
    sim_gvn_hour_qty: number
    total_gvn_hour_qty: number
}

// Datos enriquecidos con total_all
interface EnrichedTripulanteData extends TripulanteData {
    total_all: number
}

// Interfaz para la respuesta del stored procedure
interface TripulantesResponse {
    startDate: string
    endDate: string
    tripulantes: TripulanteData[]
}

// Configuración del gráfico
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

// Función para obtener la etiqueta legible del rango
const getRangeLabel = (params: StatsParams): string => {
    if (params.range_type === 'predefined' && params.predefined_range) {
        const labels: Record<string, string> = {
            'ultimos-7-dias': 'Últimos 7 días',
            'ultimos-30-dias': 'Últimos 30 días',
            'ultimos-90-dias': 'Últimos 90 días',
            'ultimos-182-dias': 'Últimos 182 días',
            'ultimos-365-dias': 'Últimos 365 días',
            'semana-actual': 'Semana actual',
            'ultima-semana': 'Última semana',
            'mes-actual': 'Mes actual',
            'ultimo-mes': 'Último mes',
            'ultimos-3-meses': 'Últimos 3 meses',
            'anio-actual': 'Año actual',
            'ultimo-anio': 'Último año',
            'ultimos-2-anios': 'Últimos 2 años',
            'historico': 'Histórico',
        }
        return labels[params.predefined_range] || params.predefined_range
    }
    if (params.range_type === 'custom' && params.date_from && params.date_to) {
        return `${params.date_from} - ${params.date_to}`
    }
    return 'Período seleccionado'
}

// Leyenda personalizada
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

export default function HorasVueloPilotos() {
    const log = useLogger('HorasVueloPilotos');
    const [chartData, setChartData] = useState<TripulanteData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [_currentRange, setCurrentRange] = useState<string>('Últimos 7 días')
    const [viewMode, setViewMode] = useState<'nh90' | 'totals'>('nh90');
    const [startDate, setStartDate] = useState<string | undefined>(undefined)
    const [endDate, setEndDate] = useState<string | undefined>(undefined)

    // Datos enriquecidos con total_all
    const enrichedChartData: EnrichedTripulanteData[] = chartData.map(d => ({
        ...d,
        total_all: d.total_day_hour_qty + d.total_night_hour_qty + d.total_gvn_hour_qty
    }))

    // Función para obtener datos del stored procedure
    const fetchData = async (params: StatsParams) => {
        setLoading(true)
        setError(undefined)

        try {
            let timeRange: string | undefined = undefined
            let customStartDate: string | undefined = undefined
            let customEndDate: string | undefined = undefined

            if (params.range_type === 'predefined' && params.predefined_range) {
                timeRange = params.predefined_range || 'ultimos-7-dias'
            } else if (params.range_type === 'custom' && params.date_from && params.date_to) {
                customStartDate = params.date_from
                customEndDate = params.date_to
            } else {
                timeRange = 'ultimos-7-dias'
            }

            // GET /hours/nh90-period: el backend Go espera time_range / person_rol / custom_*_date como query params.
            const data = await http<TripulantesResponse>('GET', '/hours/nh90-period', {
                query: {
                    time_range: timeRange,
                    person_rol: 'Piloto',
                    custom_start_date: customStartDate,
                    custom_end_date: customEndDate,
                },
            })

            if (data.tripulantes && Array.isArray(data.tripulantes)) {
                setChartData(data.tripulantes)
                setStartDate(data.startDate)
                setEndDate(data.endDate)
            } else {
                setChartData([])
                setStartDate(undefined)
                setEndDate(undefined)
            }

            setCurrentRange(getRangeLabel(params))

        } catch (err) {
            log.error(`Error fetching data: ${err}`)
            setError(err instanceof Error ? err.message : 'Error al obtener los datos')
            setChartData([])
        } finally {
            setLoading(false)
        }
    }

    // Handler para cuando cambia el rango de fechas
    const handleDateRangeChange = (params: StatsParams) => {
        log.debug(`Rango de fechas cambiado: ${JSON.stringify(params)}`)
        fetchData(params)
    }

    // Función helper para formatear fecha
    const formatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
        {/* Header */}
        <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
                <GradientTitle>
                    Horas de vuelo
                </GradientTitle>
            </div>
        </div>

        <div className="w-full space-y-4 p-4">
            {/* Selector de vista */}
            <ViewModeToggleNH90Totals
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                    setViewMode(mode);
                }}
            />

            {/* Componente de selección de rango de fechas */}
            <SegmentedDateRangeAether
                onDataReceived={handleDateRangeChange}
                debounceMs={800}
                currentDateFrom={startDate}
                currentDateTo={endDate}
            />

            {viewMode === 'nh90' && (
                <>
                    {/* Gráfico de barras apiladas */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-foreground">Horas de vuelo</CardTitle>
                            <CardDescription>
                                {startDate && endDate
                                    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                                    : 'Selecciona un rango de fechas'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center h-[400px]">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        <span className="text-sm text-muted-foreground">Cargando datos...</span>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-[400px]">
                                    <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                                        <p className="text-sm text-destructive">{error}</p>
                                    </div>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="flex items-center justify-center h-[400px]">
                                    <p className="text-sm text-muted-foreground">No hay datos disponibles para el período seleccionado</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <ChartContainer
                                        config={chartConfig}
                                        className="w-full"
                                        style={{ height: '400px', minWidth: `${Math.max(800, chartData.length * 100)}px` }}
                                    >
                                        <ComposedChart
                                            accessibilityLayer
                                            data={enrichedChartData}
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

                                                    const data = payload[0].payload as EnrichedTripulanteData;

                                                    const periods = [
                                                        {
                                                            label: "Día",
                                                            real: data.real_day_hour_qty,
                                                            sim: data.sim_day_hour_qty,
                                                            total: data.total_day_hour_qty,
                                                            color: "var(--color-day-hour)",
                                                        },
                                                        {
                                                            label: "Noche",
                                                            real: data.real_night_hour_qty,
                                                            sim: data.sim_night_hour_qty,
                                                            total: data.total_night_hour_qty,
                                                            color: "var(--color-night-hour)",
                                                        },
                                                        {
                                                            label: "GVN",
                                                            real: data.real_gvn_hour_qty,
                                                            sim: data.sim_gvn_hour_qty,
                                                            total: data.total_gvn_hour_qty,
                                                            color: "var(--color-gvn-hour)",
                                                        },
                                                    ];

                                                    return (
                                                        <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[220px]">
                                                            {/* Nombre del piloto */}
                                                            <div className="mb-2 pb-1.5 border-b">
                                                                <span className="text-sm font-semibold text-foreground">
                                                                    {data.person_nk}
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
                                                                        {((data.real_day_hour_qty ?? 0) + (data.real_night_hour_qty ?? 0) + (data.real_gvn_hour_qty ?? 0)).toFixed(1)}
                                                                        <span className="font-normal">h</span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center text-xs text-muted-foreground">
                                                                    <span>Total Simulado</span>
                                                                    <span className="ml-auto font-mono tabular-nums">
                                                                        {((data.sim_day_hour_qty ?? 0) + (data.sim_night_hour_qty ?? 0) + (data.sim_gvn_hour_qty ?? 0)).toFixed(1)}
                                                                        <span className="font-normal">h</span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center text-sm font-semibold">
                                                                    <span>Total</span>
                                                                    <span className="ml-auto font-mono tabular-nums">
                                                                        {(data.total_all ?? 0).toFixed(1)}
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
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

        </div>
        </div>
    )
}
