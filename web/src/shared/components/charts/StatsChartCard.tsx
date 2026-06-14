import type { ReactNode } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface StatsChartCardProps {
    title: ReactNode
    description?: ReactNode
    isLoading?: boolean
    /** Mensaje de error ya resuelto (no el objeto Error). */
    error?: string
    isEmpty?: boolean
    emptyMessage?: string
    loadingMessage?: string
    /** Altura de la zona de estado; debe coincidir con la altura del chart. */
    stateHeight?: number | string
    /** El gráfico concreto (normalmente un ChartContainer de recharts). */
    children: ReactNode
    className?: string
}

/**
 * Andamiaje reutilizable para gráficos de estadísticas: Card con cabecera y el
 * triple estado carga / error / vacío. El gráfico concreto se inyecta como
 * children (es agnóstico de recharts y del shape de los datos).
 */
export function StatsChartCard({
    title,
    description,
    isLoading = false,
    error,
    isEmpty = false,
    emptyMessage = 'No hay datos disponibles para el período seleccionado',
    loadingMessage = 'Cargando datos...',
    stateHeight = 400,
    children,
    className,
}: StatsChartCardProps) {
    const stateStyle = { height: typeof stateHeight === 'number' ? `${stateHeight}px` : stateHeight }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-foreground">{title}</CardTitle>
                {description !== undefined && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center" style={stateStyle}>
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center" style={stateStyle}>
                        <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    </div>
                ) : isEmpty ? (
                    <div className="flex items-center justify-center" style={stateStyle}>
                        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                    </div>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    )
}
