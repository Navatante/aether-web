// src/features/ratings/pages/OperationalRatings.tsx
//
// Página de calificaciones operativas (refactorizada).
// Solo lectura - muestra estado calculado (SA, CA, LCR, CR).

import { useState } from 'react';
import { Info } from 'lucide-react';
import { useApiQuery } from '@/lib/apiQuery';
import { useEscuadrilla } from '@/providers';
import { queryKeys } from '@/lib/queryKeys';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip';
import ViewModeTogglePilotsDvs from '../components/ViewModeTogglePilotsDvs';
import { GradientTitle } from '@/shared/components/common';

// Utilidades del feature
import {
    type ViewMode,
    type Rating,
    type CertificationData,
    COLOR_PALETTE,
} from '..';
import type { ColorName } from '../utils/colors';

// Componentes del feature
import {
    RatingFilters,
    RatingTable,
    RatingLoading,
    RatingError,
} from '../components';

// ============================================================================
// TYPES
// ============================================================================

interface CalificacionOperativa {
    abrv: string;
    name: string;
    message_instruction: string;
    message_hours: string;
    message_crp: string;
}

interface PersonWithRating {
    person_sk: number;
    person_nk: string;
    full_name: string;
    person_rol: string;
    calificacion_operativa: CalificacionOperativa;
}

interface OperationalStatusData {
    todos_pilotos: PersonWithRating[];
    todas_dotaciones: PersonWithRating[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Ratings operativos adaptados a la estructura Rating compartida
const OPERATIONAL_RATINGS: Rating[] = [
    { crew_rating_sk: 1, abbreviation: 'SA', name: 'Sin aptitud' },
    { crew_rating_sk: 2, abbreviation: 'CA', name: 'Con aptitud' },
    { crew_rating_sk: 3, abbreviation: 'LCR', name: 'Limitado para el combate' },
    { crew_rating_sk: 4, abbreviation: 'CR', name: 'Preparado para el combate' },
];

// Mapa de colores por crew_rating_sk
const OPERATIONAL_COLORS: Record<number, ColorName> = {
    1: 'red',    // SA
    2: 'orange', // CA
    3: 'blue',   // LCR
    4: 'green',  // CR
};

// Mapa de abreviatura a crew_rating_sk
const ABRV_TO_SK: Record<string, number> = {
    SA: 1,
    CA: 2,
    LCR: 3,
    CR: 4,
};

const PILOT_REQUIREMENTS = [
    { rating: 'CR', label: 'Preparado para el combate', requirements: '≥140 horas en 365 días y >80 CRP' },
    { rating: 'LCR', label: 'Limitado para el combate', requirements: 'PI2 completado, ≥100 horas en 365 días y ≥40 CRP' },
    { rating: 'CA', label: 'Con aptitud', requirements: 'PI1 completado y ≥50 horas en 365 días' },
    { rating: 'SA', label: 'Sin aptitud', requirements: 'No cumple requisitos anteriores' },
];

const CREW_REQUIREMENTS = [
    { rating: 'CR', label: 'Preparado para el combate', requirements: '≥75 horas en 365 días y >80 CRP' },
    { rating: 'LCR', label: 'Limitado para el combate', requirements: 'PI2 completado, ≥50 horas en 365 días y ≥40 CRP' },
    { rating: 'CA', label: 'Con aptitud', requirements: 'PI1 completado y ≥12 horas en 365 días' },
    { rating: 'SA', label: 'Sin aptitud', requirements: 'No cumple requisitos anteriores' },
];

// ============================================================================
// HOOK PERSONALIZADO PARA OPERATIONAL RATINGS
// ============================================================================

function useOperationalRatings() {
    const { id: escuadrillaId } = useEscuadrilla();
    // Main data query → GET /ratings/operational
    const { data: rawData, isLoading, error: queryError, refetch } = useApiQuery<OperationalStatusData>(
        'GET',
        '/ratings/operational',
        undefined,
        queryKeys.ratings.operational(escuadrillaId ?? 0),
    );
    const data = rawData ?? null;
    const error = queryError?.message ?? null;

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRating, setSelectedRating] = useState('Todas las calificaciones');
    const [viewMode, setViewMode] = useState<ViewMode>('pilots');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Derive personFullNameMap and personDataMap from data
    const { personFullNameMap, personDataMap } = (() => {
        const fullNameMap: Record<string, string> = {};
        const dataMap: Record<string, PersonWithRating> = {};

        if (data) {
            data.todos_pilotos.forEach((pilot) => {
                if (pilot.full_name) fullNameMap[pilot.person_nk] = pilot.full_name.trim();
                dataMap[pilot.person_nk] = pilot;
            });
            data.todas_dotaciones.forEach((crew) => {
                if (crew.full_name) fullNameMap[crew.person_nk] = crew.full_name.trim();
                dataMap[crew.person_nk] = crew;
            });
        }

        return { personFullNameMap: fullNameMap, personDataMap: dataMap };
    })();

    // Current personnel based on view mode (returns string[] for RatingTable)
    const currentPersonnel = (() => {
        const personnel = viewMode === 'pilots'
            ? (data?.todos_pilotos || [])
            : (data?.todas_dotaciones || []);
        return personnel.map(p => p.person_nk);
    })();

    // Build certifications data from operational ratings
    // Each person has certified=true only for their active rating
    const certifications = ((): CertificationData => {
        const certs: CertificationData = {};
        const personnel = viewMode === 'pilots'
            ? (data?.todos_pilotos || [])
            : (data?.todas_dotaciones || []);

        personnel.forEach((person) => {
            const abrv = person.calificacion_operativa?.abrv;
            const activeSk = abrv ? ABRV_TO_SK[abrv] : undefined;

            certs[person.person_nk] = {};
            OPERATIONAL_RATINGS.forEach((rating) => {
                certs[person.person_nk][rating.crew_rating_sk] = {
                    certified: rating.crew_rating_sk === activeSk,
                };
            });
        });

        return certs;
    })();

    // Filtered personnel (returns string[])
    const filteredPersonnel = (() => {
        const personnel = viewMode === 'pilots'
            ? (data?.todos_pilotos || [])
            : (data?.todas_dotaciones || []);

        return personnel
            .filter((person) => {
                const matchesSearch =
                    person.person_nk.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    person.full_name.toLowerCase().includes(searchTerm.toLowerCase());

                // selectedRating es el crew_rating_sk como string, o 'Todas las calificaciones'
                const matchesRating =
                    selectedRating === 'Todas las calificaciones' ||
                    ABRV_TO_SK[person.calificacion_operativa?.abrv] === Number(selectedRating);

                return matchesSearch && matchesRating;
            })
            .map(p => p.person_nk);
    })();

    // Actions
    const refresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    return {
        data,
        personFullNameMap,
        personDataMap,
        certifications,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        viewMode,
        setViewMode,
        isRefreshing,
        currentPersonnel,
        filteredPersonnel,
        refresh,
    };
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface OperationalTooltipProps {
    calificacion: CalificacionOperativa;
    isPilot: boolean;
}

function OperationalTooltip({ calificacion, isPilot }: OperationalTooltipProps) {
    const requirements = isPilot ? PILOT_REQUIREMENTS : CREW_REQUIREMENTS;

    return (
        <div className="space-y-4 max-w-md">
            {/* Información actual de la persona */}
            <div className="space-y-2">
                {calificacion.message_instruction && (
                    <div className="flex items-start gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">📋</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {calificacion.message_instruction}
                        </span>
                    </div>
                )}

                {calificacion.message_hours && (
                    <div className="flex items-start gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">⏱️</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {calificacion.message_hours}
                        </span>
                    </div>
                )}

                {calificacion.message_crp && (
                    <div className="flex items-start gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">⚔</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {calificacion.message_crp}
                        </span>
                    </div>
                )}
            </div>

            {/* Requisitos de certificaciones operativas */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Requisitos Operativos {isPilot ? 'Pilotos' : 'Dotaciones'}
                    </span>
                </div>

                <div className="space-y-2">
                    {requirements.map((req) => {
                        const sk = ABRV_TO_SK[req.rating];
                        const colors = COLOR_PALETTE[OPERATIONAL_COLORS[sk]];
                        return (
                            <div key={req.rating} className="text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`${colors.text} font-bold`}>{req.rating}</span>
                                    <span className="text-gray-600 dark:text-gray-400">({req.label})</span>
                                </div>
                                <div className="text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                                    {req.requirements}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OperationalRatings() {
    const {
        personFullNameMap,
        personDataMap,
        certifications,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        viewMode,
        setViewMode,
        isRefreshing,
        filteredPersonnel,
        refresh,
    } = useOperationalRatings();

    // Render cell - solo lectura, muestra estado activo/inactivo
    const renderCell = (personKey: string, rating: Rating) => {
        const isCertified = certifications[personKey]?.[rating.crew_rating_sk]?.certified || false;
        const colorName = OPERATIONAL_COLORS[rating.crew_rating_sk];
        const colors = COLOR_PALETTE[colorName];
        const personData = personDataMap[personKey];

        if (isCertified) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            className={`inline-flex items-center justify-center p-3 rounded-xl cursor-help ${colors.bg} border-2 ${colors.border} shadow-lg ${colors.shadow}`}
                        >
                            <span className={`${colors.text} font-bold text-base`}>
                                {rating.abbreviation}
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" variant="info" className="p-4 min-w-[300px]">
                        <OperationalTooltip
                            calificacion={personData?.calificacion_operativa}
                            isPilot={viewMode === 'pilots'}
                        />
                    </TooltipContent>
                </Tooltip>
            );
        }

        return (
            <div className="inline-flex items-center justify-center p-3 rounded-xl bg-gray-100 dark:bg-white/5 border-2 border-gray-300 dark:border-white/10 opacity-30">
                <span className="w-5 h-5"></span>
            </div>
        );
    };

    // Loading state
    if (isLoading) {
        return <RatingLoading message="Cargando estado operativo..." />;
    }

    // Error state
    if (error) {
        return <RatingError error={error} onRetry={() => window.location.reload()} />;
    }

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            <div className="w-full mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <GradientTitle>Calificaciones Operativas</GradientTitle>
                    </div>
                </div>

                {/* View mode toggle */}
                <ViewModeTogglePilotsDvs
                    viewMode={viewMode}
                    onViewModeChange={(mode) => {
                        setViewMode(mode);
                        setSelectedRating('Todas las calificaciones');
                        setSearchTerm('');
                    }}
                    onResetFilters={() => {
                        setSelectedRating('Todas las calificaciones');
                        setSearchTerm('');
                    }}
                />

                {/* Filters */}
                <RatingFilters
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    selectedRating={selectedRating}
                    onRatingChange={setSelectedRating}
                    ratings={OPERATIONAL_RATINGS}
                    colorMap={OPERATIONAL_COLORS}
                    searchPlaceholder={`Buscar ${viewMode === 'pilots' ? 'piloto' : 'dotación'}...`}
                    onRefresh={refresh}
                    isRefreshing={isRefreshing}
                />

                {/* Table */}
                <RatingTable
                    personnel={filteredPersonnel}
                    ratings={OPERATIONAL_RATINGS}
                    certifications={certifications}
                    colorMap={OPERATIONAL_COLORS}
                    personFullNameMap={personFullNameMap}
                    personColumnLabel={viewMode === 'pilots' ? 'Piloto' : 'Dotación'}
                    renderCell={renderCell}
                />

                {/* Empty state */}
                {filteredPersonnel.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">
                            No se encontraron resultados para los filtros seleccionados
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
