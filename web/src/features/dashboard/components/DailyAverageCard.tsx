// src/features/dashboard/components/DailyAverageCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info } from "lucide-react"
import type { DashboardDynamicStats } from "@/types/dashboard"

interface DashboardStatistics {
    horasReales: number
    diasVolados: number
    promedioDiasVolados: string
    fechaInicio: Date
    fechaFin: Date
    diasTotalesPeriodo: number
    diasConRegistro: number
    diasSoloSimulador: number
    diasSinActividad: number
    promedioTodosPeriodo: string
    porcentajeDiasVolados: string
    vuelosReales: number
}

interface DailyAverageCardProps {
    dynamicStats: DashboardDynamicStats
}

// Statistics calculation function
function computeStatistics(dynamicStats: DashboardDynamicStats): DashboardStatistics {
    const horasReales = (dynamicStats.resumenGeneral?.totalHoras ?? 0) -
        (dynamicStats.resumenGeneral?.horasSimulador ?? 0)

    // Contar días con vuelo real
    const diasVolados = (dynamicStats.horasDeVuelo ?? []).filter(d => d.real > 0).length

    const promedioDiasVolados = (horasReales / Math.max(1, diasVolados)).toFixed(1)

    // Calcular el rango total de días del período usando fechaInicio y fechaFin
    const fechaInicio = new Date(dynamicStats.fechaInicio)
    const fechaFin = new Date(dynamicStats.fechaFin)

    // Calcular días totales en el rango calendario (incluyendo todos los días)
    const diasTotalesPeriodo = Math.max(
        1,
        Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )

    // Días con registro en la base de datos (días con cualquier actividad)
    const diasConRegistro = (dynamicStats.horasDeVuelo ?? []).length

    // Días con solo simulador (tienen registro pero real = 0)
    const diasSoloSimulador = diasConRegistro - diasVolados

    // Días sin ningún registro (ni vuelo real ni simulador)
    const diasSinActividad = diasTotalesPeriodo - diasConRegistro

    const promedioTodosPeriodo = (horasReales / diasTotalesPeriodo).toFixed(1)

    // Porcentaje de días volados sobre el total del período
    const porcentajeDiasVolados = ((diasVolados / diasTotalesPeriodo) * 100).toFixed(1)

    // Obtener el total de vuelos reales
    const vuelosReales = (dynamicStats.resumenGeneral?.totalVuelos ?? 0) -
        (dynamicStats.resumenGeneral?.vuelosSimulador ?? 0)

    return {
        horasReales,
        diasVolados,
        promedioDiasVolados,
        fechaInicio,
        fechaFin,
        diasTotalesPeriodo,
        diasConRegistro,
        diasSoloSimulador,
        diasSinActividad,
        promedioTodosPeriodo,
        porcentajeDiasVolados,
        vuelosReales,
    }
}

// Tooltip component
function StatisticsTooltip({
    statistics
}: {
    statistics: DashboardStatistics
}) {
    const {
        fechaInicio,
        fechaFin,
        diasTotalesPeriodo,
        diasVolados,
        porcentajeDiasVolados,
        diasSoloSimulador,
        diasSinActividad,
        promedioDiasVolados,
        promedioTodosPeriodo,
        vuelosReales,
        horasReales,
    } = statistics

    return (
        <div className="absolute left-0 right-0 top-full mt-2 p-4 bg-popover border rounded-lg shadow-xl
            opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-200 z-50 pointer-events-none
            min-w-[280px] max-w-[320px]">
            <div className="space-y-3 text-xs">
                <div className="font-semibold text-sm border-b pb-2">
                    Desglose del Periodo
                </div>

                <div className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-1.5">
                    <span className="text-muted-foreground">Periodo analizado:</span>
                    <span className="font-medium text-right">
                        {fechaInicio.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: diasTotalesPeriodo > 365 ? 'numeric' : undefined
                        })} - {fechaFin.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        })}
                    </span>

                    <span className="text-muted-foreground">Dias totales del periodo:</span>
                    <span className="font-medium text-right">{diasTotalesPeriodo} dias</span>

                    <span className="text-muted-foreground">Dias con vuelo real:</span>
                    <span className="font-medium text-right text-green-600 dark:text-green-400">
                        {diasVolados} {diasVolados === 1 ? 'dia' : 'dias'} ({porcentajeDiasVolados}%)
                    </span>

                    {diasSoloSimulador > 0 && (
                        <>
                            <span className="text-muted-foreground">Dias solo simulador:</span>
                            <span className="font-medium text-right text-blue-600 dark:text-blue-400">
                                {diasSoloSimulador} {diasSoloSimulador === 1 ? 'dia' : 'dias'}
                            </span>
                        </>
                    )}

                    <span className="text-muted-foreground">Dias sin actividad:</span>
                    <span className="font-medium text-right text-gray-500">
                        {diasSinActividad} {diasSinActividad === 1 ? 'dia' : 'dias'}
                    </span>
                </div>

                <div className="pt-2 mt-2 border-t space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                            Promedio (dias volados):
                        </span>
                        <span className="font-bold text-sm text-primary">
                            {promedioDiasVolados}h/dia
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                            Promedio (periodo completo):
                        </span>
                        <span className="font-medium">
                            {promedioTodosPeriodo}h/dia
                        </span>
                    </div>
                    {vuelosReales > 0 && (
                        <div className="flex justify-between items-center text-[10px] opacity-75">
                            <span className="text-muted-foreground">
                                Promedio por vuelo:
                            </span>
                            <span className="font-medium">
                                {(horasReales / vuelosReales).toFixed(1)}h/vuelo
                            </span>
                        </div>
                    )}
                    <div className="text-[10px] text-muted-foreground italic pt-1 border-t">
                        El promedio principal considera solo los dias con actividad de vuelo real
                    </div>
                </div>
            </div>
        </div>
    )
}

// Main component
function DailyAverageCard({ dynamicStats }: DailyAverageCardProps) {
    const statistics = computeStatistics(dynamicStats)

    return (
        <Card className="relative group">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2  text-foreground">
                    Promedio Real Diario
                    <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold  text-foreground">
                    {statistics.promedioDiasVolados}h
                </div>
                <p className="text-xs text-muted-foreground">
                    por dia volado
                </p>

                <StatisticsTooltip statistics={statistics} />
            </CardContent>
        </Card>
    )
}

export default DailyAverageCard
