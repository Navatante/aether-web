// Página de Esfuerzo: solo render. Estado, query y derivados en useEffort.
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {ActionButton, ToggleButtonGroup} from "@/shared/components/common";
import { RefreshCw, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GradientTitle, PageControls } from "@/shared/components/common";
import { ESCALAS, useEffort } from "../hooks/useEffort";

const chartConfig = {
    days: {
        label: "días",
    },
} satisfies ChartConfig

export default function Effort() {
    const {
        fechaFin,
        calendarOpen,
        setCalendarOpen,
        handleFechaChange,
        escalaFilter,
        toggleEscala,
        chartData,
        chartHeight,
        isFetching,
        refetch,
    } = useEffort();

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
                                <span className="text-sm text-muted-foreground">
                                    Últimos 730 días hasta:
                                </span>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger render={
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
                                    } />
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
                                items={ESCALAS}
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
                                    stroke="var(--effort-limit)"
                                    strokeWidth={2}
                                    strokeDasharray="3 3"
                                    label={{
                                        value: "Límite: 210",
                                        position: "top",
                                        fill: "var(--effort-limit)",
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
