import { useState } from 'react';
import {cn, formatearFecha} from "@/lib/utils";
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

interface Papeleta {
    papeleta_sk: number;
    papeleta_name: string;
    papeleta_description: string;
    papeleta_block: string;
    papeleta_plan: string;
}

interface PapeletaRealizada {
    session_fk: number;
    flight_datetime: string;
}

interface Persona {
    person_sk: number;
    person_nk: string;
    full_name: string;
    order_position: number;
    papeletas_realizadas: PapeletaRealizada[] | null;
}

interface PapeletasPersonasData {
    papeletas: Papeleta[];
    personas: Persona[];
}

// Memoized status cell component with native tooltip for performance
// Avoids creating hundreds of Radix Tooltip instances
interface StatusCellProps {
    personSk: number;
    papeletaSk: number;
    papeletasRealizadas: PapeletaRealizada[] | null;
}

function StatusCell({ personSk, papeletaSk, papeletasRealizadas }: StatusCellProps) {
    const realizada = papeletasRealizadas?.find(pr => pr.session_fk === papeletaSk) ?? null;
    const isCompleted = realizada !== null;

    const tooltipText = isCompleted
        ? `Papeleta realizada el ${formatearFecha(realizada.flight_datetime)}`
        : 'Nunca se realizó esta papeleta';

    return (
        <td key={personSk} className="text-center p-2">
            <div
                title={tooltipText}
                className={cn(
                    "inline-flex items-center justify-center w-12 h-12 rounded-lg border transition-all cursor-help",
                    isCompleted
                        ? 'bg-gradient-to-br from-emerald-950/30 to-emerald-900/10 border-emerald-700/30'
                        : 'bg-gradient-to-br from-neutral-900/50 to-neutral-800/30 border-neutral-700/30'
                )}
            >
                {isCompleted ? (
                    <span className="text-emerald-400 text-lg">✓</span>
                ) : (
                    <span className="text-gray-600">-</span>
                )}
            </div>
        </td>
    );
}

export default function InstruccionDotaciones() {
    const instruccionArgs = { roles: 'Dotación,Dotación/Nadador', planes: 'Instrucción 1 Dotación,Instrucción 2 Dotación' };
    const { id: escId } = useEscuadrilla();
    const { data, isLoading, error: queryError, refetch } = useApiQuery<PapeletasPersonasData>(
        'GET',
        '/training/instruccion',
        { query: instruccionArgs },
        queryKeys.training.instruccion.dotaciones(escId ?? 0, instruccionArgs),
    );
    const error = queryError?.message ?? null;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
    const [selectedPlan, setSelectedPlan] = useState<string>('Todos los planes');
    const [selectedBlock, setSelectedBlock] = useState<string>('Todos los bloques');

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const { uniquePlans, uniqueBlocks } = (() => {
        if (!data) return { uniquePlans: [], uniqueBlocks: [] };
        const plans = [...new Set((data.papeletas ?? []).map(p => p.papeleta_plan))].sort();
        const blocks = [...new Set((data.papeletas ?? []).map(p => p.papeleta_block))].sort();
        return { uniquePlans: plans, uniqueBlocks: blocks };
    })();

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

    const visiblePersons = (() => {
        if (!data) return [];
        if (selectedPersonas.size === 0) return data.personas ?? [];
        return (data.personas ?? []).filter(p => selectedPersonas.has(p.person_nk));
    })();

    const filteredPapeletas = (() => {
        if (!data) return [];

        return (data.papeletas ?? [])
            .filter(papeleta => {
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const matchesName = papeleta.papeleta_name.toLowerCase().includes(term);
                    const matchesDescription = papeleta.papeleta_description.toLowerCase().includes(term);
                    if (!matchesName && !matchesDescription) return false;
                }
                if (selectedPlan !== 'Todos los planes' && papeleta.papeleta_plan !== selectedPlan) return false;
                if (selectedBlock !== 'Todos los bloques' && papeleta.papeleta_block !== selectedBlock) return false;
                return true;
            })
            .sort((a, b) => a.papeleta_name.localeCompare(b.papeleta_name));
    })();

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
                    {/* Header */}
                    <div className="flex-shrink-0 sticky top-0 z-20 bg-inherit pb-4">
                        <div className="mb-8 text-center">
                            <GradientTitle>Instrucción de Dotaciones</GradientTitle>
                        </div>

                        {/* Controles */}
                        <PageControls className="space-y-4">
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
                    </div>

                    {/* Tabla */}
                    <PageTableContainer className="flex-1 overflow-auto">
                        <table className="w-full" role="table">
                            <thead className="sticky top-0 z-10 bg-gray-100/70 dark:bg-neutral-800/95">
                            <tr>
                                <th className="text-left font-semibold text-table-header-foreground p-4 w-0 whitespace-nowrap sticky left-0 z-20 bg-gray-100/70 dark:bg-neutral-800/95" />
                                {visiblePersons.map(persona => (
                                    <th key={persona.person_sk} className="text-center p-4 min-w-[80px]">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                    <span className="font-semibold text-gray-300 cursor-help">
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
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {filteredPapeletas.length === 0 ? (
                                <tr>
                                    <td colSpan={visiblePersons.length + 1} className="p-8 text-center text-gray-500">
                                        No se encontraron papeletas
                                    </td>
                                </tr>
                            ) : (
                                filteredPapeletas.map((papeleta, idx) => (
                                    <tr
                                        key={papeleta.papeleta_sk}
                                        className={cn(
                                            "border-b border-gray-800/50 hover:bg-gray-800/20",
                                            idx % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-gray-50 dark:bg-transparent'
                                        )}
                                    >
                                        {/* Celda de papeleta con tooltip de descripción */}
                                        <td className={cn(
                                            "p-4 min-w-0 whitespace-nowrap sticky left-0 z-5 border-b border-gray-100/70 dark:border-neutral-800/95",
                                            idx % 2 === 0 ? 'bg-white dark:bg-[#1a1a1a]' : 'bg-gray-50 dark:bg-neutral-900'
                                        )}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                        <span className="font-medium text-gray-200 cursor-help">
                                                            {papeleta.papeleta_name}
                                                        </span>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    side="top"
                                                    sideOffset={8}
                                                    variant="info"
                                                >
                                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                                        {papeleta.papeleta_description}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </td>

                                        {/* Celdas de estado por piloto - usa StatusCell memoizado con tooltip nativo */}
                                        {visiblePersons.map(persona => (
                                            <StatusCell
                                                key={persona.person_sk}
                                                personSk={persona.person_sk}
                                                papeletaSk={papeleta.papeleta_sk}
                                                papeletasRealizadas={persona.papeletas_realizadas}
                                            />
                                        ))}
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
