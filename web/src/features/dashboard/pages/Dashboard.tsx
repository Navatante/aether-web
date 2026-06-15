// src/features/dashboard/pages/Dashboard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
    AlertCircle,
    Wrench,
    UsersRound,
    UserRoundCheck,
    UserRoundCog, Laptop
} from "lucide-react"
import { useEscuadrilla, useUserData } from "@/providers"
import { useApiQuery } from "@/lib/apiQuery"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    ChartAreaInteractive,
    HourByEventBarChartMixed,
    HourByPeriodBarChart,
    HourByHelicopterBarChart,
    HourByAuthorityBarChart,
} from "@/features/dashboard/components/charts"
import {
    DashboardStaticStats,
    DashboardDynamicStats,
    DashboardStatsParams,
    ChartDataPoint,
    HelicoperData,
    HorasPorAutoridad,
    BarChartData,
    HorasPorPeriodo
} from "@/types/dashboard"
import { useState } from "react"
import GlassProgressBarBig from "@/shared/components/common/GlassProgressBarBig"
import { GradientTitle, SegmentedDateRangeAether } from "@/shared/components/common"
import { queryKeys } from "@/lib/queryKeys"
import StaticDashboardDetailsList, { type DetailItem } from "../components/StaticDashboardDetailsList.tsx"
import { StaticDashboardDataCard } from "../components"
import DailyAverageCard from "../components/DailyAverageCard"

// Componente principal del Dashboard
export default function Dashboard() {
    const { fullName, loading: userLoading, error: userError, escuadrillaId } = useUserData();
    const firstName = fullName?.split(' ')[0] || 'Usuario';
    const { name } = useEscuadrilla();

    // Estadísticas estáticas via TanStack Query → GET /dashboard/static-stats
    const {
        data: staticData,
        isLoading: staticLoading,
        error: staticQueryError,
    } = useApiQuery<DashboardStaticStats>(
        'GET',
        '/dashboard/static-stats',
        undefined,
        queryKeys.dashboard.static(escuadrillaId ?? 0),
    );
    const staticError = staticQueryError?.message ?? null;

    // Estadísticas dinámicas (params-driven) vía TanStack Query → POST
    // /dashboard/dynamic-stats. El selector de rango solo fija los params; la
    // query refetchea y cachea por combinación de params + escuadrilla. Se
    // habilita cuando hay params y la escuadrilla ya está disponible (esto
    // sustituye al antiguo `pendingParams` + fetch manual).
    const [statsParams, setStatsParams] = useState<DashboardStatsParams | null>(null);

    const {
        data: dynamicStatsData,
        isFetching: dynamicLoading,
        error: dynamicQueryError,
    } = useApiQuery<DashboardDynamicStats>(
        'POST',
        '/dashboard/dynamic-stats',
        {
            body: statsParams ?? undefined,
            enabled: statsParams !== null && escuadrillaId !== null,
        },
        queryKeys.dashboard.dynamic(escuadrillaId ?? 0, (statsParams ?? {}) as Record<string, unknown>),
    );
    const dynamicData = dynamicStatsData ?? null;
    const dynamicError = dynamicQueryError?.message ?? null;

    // Transformación de datos para gráficos
    const chartData = (() => {
        if (!dynamicData) {
            return {
                chartAreaData: [] as ChartDataPoint[],
                radarData: [] as HelicoperData[],
                pieData: [] as HorasPorAutoridad[],
                barData: [] as BarChartData[],
                periodPieData: null as HorasPorPeriodo | null,
            };
        }

        const chartAreaData: ChartDataPoint[] = dynamicData.horasDeVuelo?.map(item => ({
            date: item.date,
            simulador: item.simulador,
            real: item.real
        })) || [];

        const radarData: HelicoperData[] = dynamicData.horasPorHelicoptero?.map(item => ({
            helo: item.helo,
            horas: item.horas
        })) || [];

        const pieData: HorasPorAutoridad[] = dynamicData.horasPorAutoridad?.map(item => ({
            autoridad: item.autoridad,
            abreviatura: item.abreviatura,
            horas: item.horas
        })) || [];

        const barData: BarChartData[] = dynamicData.horasPorEventoLugar?.map(item => ({
            evento: item.evento || 'Sin evento',
            lugares: item.lugares || {}
        })) || [];

        const periodPieData: HorasPorPeriodo | null = dynamicData.horasPorPeriodo
            ? {
                dia_real: dynamicData.horasPorPeriodo.dia_real || 0,
                dia_simulado: dynamicData.horasPorPeriodo.dia_simulado || 0,
                noche_sin_gafas_real: dynamicData.horasPorPeriodo.noche_sin_gafas_real || 0,
                noche_sin_gafas_simulado: dynamicData.horasPorPeriodo.noche_sin_gafas_simulado || 0,
                gvn_real: dynamicData.horasPorPeriodo.gvn_real || 0,
                gvn_simulado: dynamicData.horasPorPeriodo.gvn_simulado || 0,
                anvis_real: dynamicData.horasPorPeriodo.anvis_real || 0,
                anvis_simulado: dynamicData.horasPorPeriodo.anvis_simulado || 0,
                iit_real: dynamicData.horasPorPeriodo.iit_real || 0,
                iit_simulado: dynamicData.horasPorPeriodo.iit_simulado || 0,
            }
            : null;

        return { chartAreaData, radarData, pieData, barData, periodPieData };
    })();

    // Solo fija los params; la query reacciona (y queda diferida hasta que
    // escuadrillaId esté disponible vía `enabled`).
    const handleDateRangeChange = (params: DashboardStatsParams) => {
        setStatsParams(params);
    };

    // Datos declarativos para las tarjetas de estadísticas
    const pilotDetails: DetailItem[] = (() => {
        if (!staticData) return [];
        const { pilotos } = staticData;
        return [
            { label: "Adaptantes", value: pilotos.pqm },
            { label: "Copilotos", value: pilotos.h2p },
            { label: "Comandantes Piloto", value: pilotos.hac },
            { label: "Solo Instructores", value: pilotos.ip, indent: true },
            { label: "Solo Pruebas", value: pilotos.fcp, indent: true },
            { label: "Instructor y Pruebas", value: pilotos.ip_fcp, indent: true },
        ];
    })();

    const dotacionDetails: DetailItem[] = (() => {
        if (!staticData) return [];
        const { tripulacion_cabina } = staticData;
        return [
            { label: "Alumnos", value: tripulacion_cabina.alumnos },
            { label: "Dotaciones", value: tripulacion_cabina.dotaciones },
            { label: "Cabezas de dotación", value: tripulacion_cabina.cabezas },
            { label: "Solo Instructores", value: tripulacion_cabina.dv_instructores, indent: true },
            { label: "Solo Pruebas", value: tripulacion_cabina.dv_pruebas, indent: true },
            { label: "Instructores y Pruebas", value: tripulacion_cabina.dv_instructores_y_pruebas, indent: true },
            { label: "Nadadores", value: tripulacion_cabina.nadadores },
        ];
    })();

    const mantenedoresDetails: DetailItem[] = (() => {
        if (!staticData) return [];
        const { mantenedores } = staticData;
        return [
            { label: "Mecánicos", value: mantenedores.b1 },
            { label: "Aviónicos", value: mantenedores.b2 },
            { label: "Línea de vuelo", value: mantenedores.lv },
        ];
    })();

    const administrativosDetails: DetailItem[] = (() => {
        if (!staticData) return [];
        const { administrativos } = staticData;
        return [
            { label: "Detall", value: administrativos.detall },
            { label: "Operaciones", value: administrativos.operaciones },
            { label: "Mantenimiento", value: administrativos.mantenimiento },
        ];
    })();

    const personalTotalDetails: DetailItem[] = (() => {
        if (!staticData) return [];
        const { personal_total } = staticData;
        return [
            { label: "Oficiales", value: personal_total.oficiales },
            { label: "Suboficiales", value: personal_total.suboficiales },
            { label: "Tropa y marinería", value: personal_total.tropa_marineria },
        ];
    })();

    return (
        <div className="h-full overflow-y-auto space-y-6 p-6 pb-8">
            {/* Page Header */}
            <div className="flex items-center">
                <img
                    className="h-28 w-auto mr-6 dark:invert opacity-70"
                    src="/cabeza-sable.svg"
                    alt="Escudo Decimocuarta Escuadrilla"
                />
                <div>
                    <GradientTitle>
                        {name} Escuadrilla
                    </GradientTitle>
                    {userLoading ? (
                        <Skeleton className="h-5 w-64 mt-1" />
                    ) : userError ? (
                        <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Error cargando datos del usuario
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <p className="text-muted-foreground">
                            Bienvenido de vuelta {firstName}
                        </p>
                    )}
                </div>
            </div>

            {/* Error general de estadísticas */}
            {staticError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Error cargando estadísticas: {staticError}
                    </AlertDescription>
                </Alert>
            )}

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-6">
                {/* 5 StatsCards y las barras de Airflow y CRP ocupan 6 columnas */}
                <StaticDashboardDataCard
                    title="Pilotos"
                    value={staticData?.pilotos.total || 0}
                    icon={UserRoundCheck}
                    details={<StaticDashboardDetailsList items={pilotDetails} />}
                    loading={staticLoading}
                />

                <StaticDashboardDataCard
                    title="Tripulación de cabina"
                    value={staticData?.tripulacion_cabina.total || 0}
                    icon={UserRoundCog}
                    details={<StaticDashboardDetailsList items={dotacionDetails} />}
                    loading={staticLoading}
                />

                <StaticDashboardDataCard
                    title="Mantenedores"
                    value={staticData?.mantenedores.total || 0}
                    icon={Wrench}
                    details={<StaticDashboardDetailsList items={mantenedoresDetails} />}
                    loading={staticLoading}
                />

                <StaticDashboardDataCard
                    title="Administrativos"
                    value={staticData?.administrativos.total || 0}
                    icon={Laptop}
                    details={<StaticDashboardDetailsList items={administrativosDetails} />}
                    loading={staticLoading}
                />

                <StaticDashboardDataCard title="Efectivos totales"
                           value={staticData?.personal_total.total || 0}
                           icon={UsersRound}
                           details={<StaticDashboardDetailsList items={personalTotalDetails} />}
                           loading={staticLoading}
                />

                <Card>
                    <CardContent className="p-4 h-full flex flex-col lg:flex-row items-center justify-center gap-4">
                        {/* Progress Bars */}
                        {staticLoading ? (
                            <div className="flex gap-6 h-[150px] items-center">
                                <Skeleton className="h-28 w-9 rounded-full" />
                                <Skeleton className="h-28 w-9 rounded-full" />
                            </div>
                        ) : (
                            <div className="flex justify-center gap-6 h-50 mt-3">
                                <GlassProgressBarBig type="airflow" value={staticData?.airflow} />
                                <GlassProgressBarBig type="crp" value={staticData?.crp} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Componente temporalidad */}
            <SegmentedDateRangeAether
                onDataReceived={handleDateRangeChange}
                debounceMs={800}
                currentDateFrom={dynamicData?.fechaInicio}
                currentDateTo={dynamicData?.fechaFin}
            />

            {/* Error de estadísticas dinámicas */}
            {dynamicError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Error cargando datos del período: {dynamicError}
                    </AlertDescription>
                </Alert>
            )}

            {/* Mostrar las estadísticas si hay datos */}
            {dynamicData && (
                <>
                    {/* Resumen General */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-foreground">Total Horas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">
                                    {(dynamicData.resumenGeneral?.totalHoras ?? 0).toFixed(1)}h
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-foreground">Reales</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">
                                    {((dynamicData.resumenGeneral?.totalHoras ?? 0) - (dynamicData.resumenGeneral?.horasSimulador ?? 0)).toFixed(1)}h
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {dynamicData.resumenGeneral.totalVuelos-dynamicData.resumenGeneral.vuelosSimulador} vuelos
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-foreground">Simulador</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">
                                    {(dynamicData.resumenGeneral?.horasSimulador ?? 0).toFixed(1)}h
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {dynamicData.resumenGeneral.vuelosSimulador} sesiones
                                </p>
                            </CardContent>
                        </Card>

                        {/* Extracted DailyAverageCard component */}
                        <DailyAverageCard dynamicStats={dynamicData} />
                    </div>

                    {/* Evolucion temporal Horas totales */}
                    <div className="grid gap-4 md:grid-cols-1">
                        {chartData.chartAreaData.length > 0 && (
                            <ChartAreaInteractive
                                jsonData={chartData.chartAreaData}
                                fechaInicio={dynamicData.fechaInicio}
                                fechaFin={dynamicData.fechaFin}
                            />
                        )}

                    </div>

                    {/* Resto de grafico de barras */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <HourByEventBarChartMixed data={chartData.barData} />
                        <HourByHelicopterBarChart data={chartData.radarData} />
                        <HourByPeriodBarChart data={chartData.periodPieData} />
                        <HourByAuthorityBarChart data={chartData.pieData} />
                    </div>
                </>
            )}

            {/* Loading state para gráficos */}
            {dynamicLoading && (
                <div className="grid gap-4">
                    <Skeleton className="h-[300px] w-full" />
                    <div className="grid gap-4 md:grid-cols-2">
                        <Skeleton className="h-[300px]" />
                        <Skeleton className="h-[300px]" />
                    </div>
                </div>
            )}
        </div>
    );
}
