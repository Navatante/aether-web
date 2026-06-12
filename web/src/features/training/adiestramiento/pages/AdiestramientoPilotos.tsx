import { useState } from 'react';

import { Search, Loader2, X, RefreshCw } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import GlassProgressBarBig from "@/shared/components/common/GlassProgressBarBig";
import GlassProgressBarSmall from "@/shared/components/common/GlassProgressBarSmall";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
} from "@/shared/components/common";
import {ToggleButton} from "@/shared/components/common/ToggleButton.tsx";
import { useApiQuery } from "@/lib/apiQuery";
import { useEscuadrilla } from "@/providers";
import { queryKeys } from "@/lib/queryKeys";

// Types
interface Papeleta {
    papeleta_sk: number;
    papeleta_name: string;
    papeleta_description: string;
    papeleta_block: string;
    papeleta_plan: string;
    papeleta_pilot_crp_value: number;
    papeleta_expiration: number;
}

interface PapeletaRealizada {
    session_fk: number;
    dias_transcurridos: number;
    dias_restantes: number;
    estado: 'Vigente' | 'Alerta' | 'Expirado';
}

interface Persona {
    person_sk: number;
    person_nk: string;
    full_name: string;
    crp: number;
    dias_sin_volar: number;
    dias_sin_vuelo_real: number;
    dias_sin_simulador: number;
    order_position: number;
    papeletas_realizadas: PapeletaRealizada[] | null;
}

interface PapeletasPersonasData {
    papeletas: Papeleta[];
    crp_medio: number;
    airflow_medio: number;
    personas: Persona[];
}

type StatusFilter = 'Todos los estados' | 'Vigente' | 'Alerta' | 'Expirado';

export default function AdiestramientoPilotos() {
    const adiestramientoArgs = { roles: 'Piloto', bloques: 'Práctico Piloto,Simulador,Vuelo' };
    const { id: escId } = useEscuadrilla();
    const { data, isLoading, error: queryError, refetch } = useApiQuery<PapeletasPersonasData>(
        'GET',
        '/training/adiestramiento',
        { query: adiestramientoArgs },
        queryKeys.training.adiestramiento.pilotos(escId ?? 0, adiestramientoArgs),
    );
    const error = queryError?.message ?? null;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos los estados');
    const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
    const [selectedPlan, setSelectedPlan] = useState<string>('Todos los planes');
    const [selectedBlock, setSelectedBlock] = useState<string>('Todos los bloques');

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    // Obtener planes y bloques únicos
    const { uniquePlans, uniqueBlocks } = (() => {
        if (!data) return { uniquePlans: [], uniqueBlocks: [] };

        const plans = [...new Set((data.papeletas ?? []).map(p => p.papeleta_plan))].sort();
        const blocks = [...new Set((data.papeletas ?? []).map(p => p.papeleta_block))].sort();

        return { uniquePlans: plans, uniqueBlocks: blocks };
    })();

    // Obtener estado de una papeleta para un piloto
    const getPapeletaStatus = (persona: Persona, papeletaSk: number): PapeletaRealizada | null => {
        if (!persona.papeletas_realizadas) return null;
        return persona.papeletas_realizadas.find(pr => pr.session_fk === papeletaSk) || null;
    };

    // Toggle piloto seleccionado
    const togglePersona = (personNk: string) => {
        setSelectedPersonas(prev => {
            const newSet = new Set(prev);
            if (newSet.has(personNk)) {
                newSet.delete(personNk);
            } else {
                newSet.add(personNk);
            }
            return newSet;
        });
    };

    // Pilotos visibles (filtrados por selección)
    const visiblePersonas = (() => {
        if (!data) return [];
        if (selectedPersonas.size === 0) return data.personas ?? [];
        return (data.personas ?? []).filter(p => selectedPersonas.has(p.person_nk));
    })();

    // Papeletas filtradas
    const filteredPapeletas = (() => {
        if (!data) return [];

        let result = (data.papeletas ?? []).filter(papeleta => {
            // Filtro de búsqueda (nombre y descripción)
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesName = papeleta.papeleta_name.toLowerCase().includes(term);
                const matchesDescription = papeleta.papeleta_description.toLowerCase().includes(term);
                if (!matchesName && !matchesDescription) {
                    return false;
                }
            }

            // Filtro de plan
            if (selectedPlan !== 'Todos los planes' && papeleta.papeleta_plan !== selectedPlan) {
                return false;
            }

            // Filtro de bloque
            if (selectedBlock !== 'Todos los bloques' && papeleta.papeleta_block !== selectedBlock) {
                return false;
            }

            // Filtro de estado
            if (statusFilter !== 'Todos los estados') {
                const hasStatus = visiblePersonas.some(persona => {
                    const status = getPapeletaStatus(persona, papeleta.papeleta_sk);
                    return status?.estado === statusFilter;
                });
                if (!hasStatus) return false;
            }

            return true;
        });

        result = result.sort((a, b) => a.papeleta_name.localeCompare(b.papeleta_name));

        return result;
    })();

    const getStatusColor = (estado: string | null): string => {
        switch (estado) {
            case 'Expirado':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'Alerta':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'Vigente':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            default:
                return 'bg-gray-800/50 text-gray-500 border-gray-700/50';
        }
    };

    const getCellBackground = (estado: string | null): string => {
        switch (estado) {
            case 'Expirado':
                return 'bg-gradient-to-br from-red-950/40 to-red-900/20';
            case 'Alerta':
                return 'bg-gradient-to-br from-amber-950/40 to-amber-900/20';
            case 'Vigente':
                return 'bg-gradient-to-br from-emerald-950/30 to-emerald-900/10';
            default:
                return 'bg-gradient-to-br from-neutral-900/50 to-neutral-800/30';
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Cargando papeletas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center bg-red-50 dark:bg-red-900/20 p-8 rounded-xl">
                    <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
                        Error al cargar papeletas
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
            <div className="h-full flex flex-col p-6 pb-8">
                <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                    {/* Header - Sticky */}
                    <div className="flex-shrink-0 sticky top-0 z-20 bg-inherit pb-4">
                        <div className="mb-8 text-center">
                            <GradientTitle>
                                Adiestramiento de Pilotos
                            </GradientTitle>
                        </div>

                        {/* Contenedor principal: Controles + GlassProgressBarBig */}
                        <div className="flex gap-6 items-center">
                            {/* Controles */}
                            <PageControls className="space-y-4 flex-1">
                                <div className="flex flex-wrap gap-4 items-center">
                                    {/* Búsqueda */}
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Buscar papeleta..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="bg-card border-input border focus:border-ring focus:outline-none transition-all placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    {/* Select Plan */}
                                    <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value ?? 'Todos los planes')}>
                                        <SelectTrigger className="min-w-[180px] bg-card border-input">
                                            <SelectValue placeholder="Todos los planes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Todos los planes">
                                                <span className="text-gray-700 dark:text-gray-300">Todos los planes</span>
                                            </SelectItem>
                                            {uniquePlans.map(plan => (
                                                <SelectItem key={plan} value={plan}>
                                                    <span className="text-gray-700 dark:text-gray-300">{plan}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Select Block */}
                                    <Select value={selectedBlock} onValueChange={(value) => setSelectedBlock(value ?? 'Todos los bloques')}>
                                        <SelectTrigger className="min-w-[180px] bg-card border-input">
                                            <SelectValue placeholder="Todos los bloques" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Todos los bloques">
                                                <span className="text-gray-700 dark:text-gray-300">Todos los bloques</span>
                                            </SelectItem>
                                            {uniqueBlocks.map(block => (
                                                <SelectItem key={block} value={block}>
                                                    <span className="text-gray-700 dark:text-gray-300">{block}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Select Estado */}
                                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                                        <SelectTrigger className="min-w-[160px] bg-card border-input">
                                            <SelectValue placeholder="Todos los estados" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Todos los estados">
                                                <span className="text-gray-700 dark:text-gray-300">Todos los estados</span>
                                            </SelectItem>
                                            <SelectItem value="Vigente">
                                                <span>Vigente</span>
                                            </SelectItem>
                                            <SelectItem value="Alerta">
                                                <span>Alerta</span>
                                            </SelectItem>
                                            <SelectItem value="Expirado">
                                                <span>Expirado</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Refresh */}
                                    <ActionButton
                                        variant="refresh"
                                        icon={RefreshCw}
                                        label="Refrescar"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        loading={isRefreshing}
                                    />
                                </div>

                                {/* Selector de pilotos */}
                                <div className="flex flex-wrap gap-2">
                                    {(data.personas ?? []).map(persona => (
                                        <ToggleButton
                                            key={persona.person_sk}
                                            label={persona.person_nk}
                                            isSelected={selectedPersonas.has(persona.person_nk)}
                                            onClick={() => togglePersona(persona.person_nk)}
                                        />
                                    ))}
                                </div>

                            </PageControls>

                            {/* airflow y CRP medios */}
                            <div className="flex justify-center gap-6 h-35 pr-8 pl-5 mb-5">

                                <GlassProgressBarBig type="airflow" value={Number((data.airflow_medio ?? 0).toFixed(0))} />
                                <GlassProgressBarBig type="crp" value={Number((data.crp_medio ?? 0).toFixed(0))} />

                            </div>

                        </div>
                    </div>

                    {/* Tabla con scroll */}
                    <PageTableContainer className="flex-1 overflow-auto">
                        <table className="w-full" role="table">
                            <thead className="sticky top-0 z-10 bg-gray-100/70 dark:bg-neutral-800/95">
                            <tr>
                                <th className="text-left font-semibold text-table-header-foreground p-4 w-0 whitespace-nowrap sticky left-0 z-20 bg-gray-100/70 dark:bg-neutral-800/95">
                                    {/* Puedes dejar vacío o poner un título si quieres */}
                                </th>
                                {visiblePersonas.map(persona => (
                                    <th key={persona.person_sk} className="text-center p-4 min-w-[80px]">
                                        <div className="flex flex-col items-center">
                                            {/* Contenedor de las barras */}
                                            <div className="flex justify-center gap-2 h-20">
                                                <GlassProgressBarSmall
                                                    type="airflow"
                                                    value={persona.dias_sin_volar}
                                                    diasSinVueloReal={persona.dias_sin_vuelo_real}
                                                    diasSinSimulador={persona.dias_sin_simulador}
                                                />
                                                <GlassProgressBarSmall type="crp" value={persona.crp}/>
                                            </div>

                                            {/* Nombre del piloto */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="font-semibold text-gray-300 mt-2 cursor-help">
                                                        {persona.person_nk}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    side="bottom"
                                                    sideOffset={10}
                                                    variant="info"
                                                >
                                                    {persona.full_name}
                                                </TooltipContent>
                                            </Tooltip>

                                        </div>

                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {filteredPapeletas.length === 0 ? (
                                <tr>
                                    <td colSpan={visiblePersonas.length + 1} className="p-8 text-center text-gray-500">
                                        No se encontraron papeletas
                                    </td>
                                </tr>
                            ) : (
                                filteredPapeletas.map((papeleta, idx) => (
                                    <tr
                                        key={papeleta.papeleta_sk}
                                        className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${
                                            idx % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-gray-50 dark:bg-transparent'
                                        }`}
                                    >
                                        <td className={`p-4 min-w-0 whitespace-nowrap sticky left-0 z-5 border-b border-gray-100/70 dark:border-neutral-800/95 ${
                                            idx % 2 === 0 ? 'bg-white dark:bg-[#1a1a1a]' : 'bg-gray-50 dark:bg-neutral-900'
                                        }`}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="cursor-help">
                                                      <span className="font-medium text-gray-200">
                                                        {papeleta.papeleta_name}
                                                      </span>
                                                    </div>
                                                </TooltipTrigger>

                                                <TooltipContent
                                                    side="top"
                                                    sideOffset={14}
                                                    variant="info" className="p-0 max-w-80 overflow-hidden"
                                                >

                                                    {/* Contenido */}
                                                    <div className="px-4 py-3 space-y-1">
                                                        <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed text-pretty">
                                                            {papeleta.papeleta_description}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Expiración: {papeleta.papeleta_expiration} días
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            CRP: {papeleta.papeleta_pilot_crp_value}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Plan: {papeleta.papeleta_plan}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Bloque: {papeleta.papeleta_block}
                                                        </p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </td>
                                        {visiblePersonas.map(persona => {
                                            const status = getPapeletaStatus(persona, papeleta.papeleta_sk);

                                            return (
                                                <td key={persona.person_sk} className="text-center p-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`
                                                                        inline-flex flex-col items-center justify-center
                                                                        w-16 h-16
                                                                        rounded-lg border
                                                                        transition-all duration-300 cursor-help
                                                                        ${getCellBackground(status?.estado || null)}
                                                                        ${getStatusColor(status?.estado || null)}
                                                                    `}
                                                            >
                                                                {status ? (
                                                                    <>
                                                                        <div className="font-bold text-lg">
                                                                            {status.dias_restantes}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-600">-</span>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="top"
                                                            variant="info" className="p-0 max-w-80 overflow-hidden"
                                                        >
                                                            {status ? (
                                                                <div className="px-4 py-3 space-y-1">
                                                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-pretty">
                                                                        Transcurridos: {status.dias_transcurridos} días
                                                                    </p>
                                                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-pretty">
                                                                        Restantes: {status.dias_restantes} días
                                                                    </p>
                                                                    <p className={`text-sm font-medium ${
                                                                        status.estado === 'Expirado' ? 'text-red-400' :
                                                                            status.estado === 'Alerta' ? 'text-amber-400' :
                                                                                'text-emerald-400'
                                                                    }`}>
                                                                        {status.estado === 'Expirado' ? '⚠️ Expirado' :
                                                                            status.estado === 'Alerta' ? '⏰ Próximo a vencer' :
                                                                                '✅ Vigente'}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="px-4 py-3">
                                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                        Nunca realizó esta papeleta
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </PageTableContainer>
                </div>
            </div>
    );
}
