"use client"
import { Bar, BarChart, XAxis, YAxis, ReferenceLine } from "recharts"
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
import { useState } from "react";
import { useApiQuery } from "@/lib/apiQuery";
import { useEscuadrilla } from "@/providers";
import { queryKeys } from "@/lib/queryKeys";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {ActionButton, ToggleButtonGroup} from "@/shared/components/common";
import { RefreshCw, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GradientTitle, PageControls } from "@/shared/components/common";

// Tipos para los datos del stored procedure
interface Esfuerzo {
    full_name: string,
    escala: string,
    dias_esfuerzo: number
}

const chartConfig = {
    days: {
        label: "días",
    },
} satisfies ChartConfig

export default function Effort() {
    const [fechaFin, setFechaFin] = useState<Date>(new Date());
    const [escalaFilter, setEscalaFilter] = useState<Set<string>>(new Set());
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Hook para datos
    const [queryParams, setQueryParams] = useState({ fechaFin: format(new Date(), 'yyyy-MM-dd') });
    const { id: escId } = useEscuadrilla();

    // El backend devuelve { items: Esfuerzo[] }; useApiQuery devuelve el objeto crudo.
    const {
        data: result,
        isFetching,
        refetch,
    } = useApiQuery<{ items: Esfuerzo[] }>(
        'GET',
        '/esfuerzo',
        { query: queryParams },
        queryKeys.effort.list(escId ?? 0, queryParams),
    );
    const data: Esfuerzo[] = result?.items ?? [];

    // Para cambiar la fecha
    const handleFechaChange = (date: Date | undefined) => {
        if (date) {
            setFechaFin(date);
            setQueryParams({ fechaFin: format(date, 'yyyy-MM-dd') });
            setCalendarOpen(false);
        }
    };

    // Escalas disponibles
    const escalas = ['Oficiales', 'Suboficiales', 'Tropa y marinería'];

    const chartData = (() => {
        let filtered = [...data]

        // Filtrar por escala
        if (escalaFilter.size > 0) {
            filtered = filtered.filter(p => escalaFilter.has(p.escala))
        }

        // Ordenar: primero por días (ascendente), luego por índice original invertido (para empates)
        const withIndex = filtered.map((item, index) => ({ item, originalIndex: index }))

        withIndex.sort((a, b) => {
            const diasA = a.item.dias_esfuerzo
            const diasB = b.item.dias_esfuerzo

            if (diasA !== diasB) {
                return diasA - diasB
            }
            return b.originalIndex - a.originalIndex
        })

        // Función para asignar color según los días
        const getBarColor = (days: number) => {
            if (days >= 210) return "rgba(220,38,38,0.3)" // red-600
            if (days >= 168) return "rgba(217,119,6,0.3)" // amber-600
            return "rgba(22,163,74,0.3)" // green-600
        }

        // Mapear al formato final con colores
        return withIndex.map(({ item }) => ({
            fullName: item.full_name,
            days: item.dias_esfuerzo,
            fill: getBarColor(item.dias_esfuerzo)
        }))
    })()

    const chartHeight = chartData.length * 35;

    // Toggle para filtros
    const toggleEscala = (escala: string) => {
        setEscalaFilter(prev => {
            const next = new Set(prev)
            if (next.has(escala)) {
                next.delete(escala)
            } else {
                next.add(escala)
            }
            return next
        })
    }

    return (
        <div className="h-full flex flex-col p-6 pb-8">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header - Fijo */}
                <div className="mb-8 text-center shrink-0">
                    <GradientTitle>Esfuerzo</GradientTitle>
                </div>

                {/* Barra de controles - Fija */}
                <div className="flex items-center justify-center gap-4 shrink-0">
                    {/* Controles agrupados a la izquierda */}
                    <PageControls>
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Calendar Popover */}
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm text-neutral-600 dark:text-neutral-200">
                                    Últimos 730 días hasta:
                                </span>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-[200px] justify-start text-left font-normal",
                                                !fechaFin && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fechaFin ? (
                                                format(fechaFin, "dd/MM/yyyy", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={fechaFin}
                                            onSelect={handleFechaChange}
                                            defaultMonth={fechaFin}
                                            captionLayout="dropdown"
                                            startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                            endMonth={new Date(new Date().getFullYear() + 10, 11)}
                                            locale={es}
                                            className="rounded-md border"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {/* Filtro por Escala */}
                            <ToggleButtonGroup
                                items={escalas}
                                selectedItems={escalaFilter}
                                onToggle={toggleEscala}
                            />

                            <ActionButton
                                variant="refresh"
                                icon={RefreshCw}
                                label="Refrescar"
                                onClick={(e) => {
                                    refetch();
                                    const icon = e.currentTarget.querySelector("svg");
                                    if (icon) {
                                        icon.classList.remove("animate-spin-once");
                                        requestAnimationFrame(() => {
                                            icon.classList.add("animate-spin-once");
                                        });
                                    }
                                }}
                                disabled={isFetching}
                                loading={isFetching}
                            />
                        </div>
                    </PageControls>
                </div>

                {/* Chart Card - Scrolleable */}
                <Card className="p-4 flex-1 min-h-0 overflow-hidden mb-12">
                    <CardContent className="h-full overflow-y-auto">
                        <ChartContainer
                            config={chartConfig}
                            style={{
                                height: Math.max(chartHeight, 100),
                                minHeight: '100%',
                                width: '100%'
                            }}
                        >
                            <BarChart
                                data={[...chartData].sort((a, b) => a.days - b.days)}
                                layout="vertical"
                                margin={{ right: -40 }}
                            >
                                <XAxis
                                    type="number"
                                    dataKey="days"
                                    reversed={true}
                                    orientation="top"
                                />
                                <YAxis
                                    dataKey="fullName"
                                    type="category"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    width={300}
                                    orientation="right"
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar dataKey="days" radius={5} />
                                <ReferenceLine
                                    x={210}
                                    stroke="rgba(220,38,38)"
                                    strokeWidth={2}
                                    strokeDasharray="3 3"
                                    label={{
                                        value: "Límite: 210",
                                        position: "top",
                                        fill: "rgba(220,38,38)",
                                        fontSize: 12,
                                    }}
                                />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
