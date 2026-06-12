// src/features/ratings/pages/ModelRatings.tsx
//
// Página de calificaciones de modelo (refactorizada).
// Usa utilidades compartidas de src/features/ratings y componentes internos.

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/logger';
import { Info, Lock } from 'lucide-react';
import { PermissionLevel, useHasPermission, useUser } from '@/providers';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import ViewModeTogglePilotsDvs from '../components/ViewModeTogglePilotsDvs';
import { GradientTitle } from '@/shared/components/common';

// Utilidades compartidas del feature
import {
    type ModelRatingsData,
    type Rating,
    type CertificationData,
    type ViewMode,
    processModelRatings,
    MODEL_RATINGS_COLORS,
    formatLocalDate,
} from '..';
import type { ColorName } from '../utils/colors';

// Componentes del feature
import {
    RatingButton,
    RatingFilters,
    RatingDeleteDialog,
    RatingTable,
    RatingLoading,
    RatingError,
} from '../components';

// ============================================================================
// HOOK PERSONALIZADO PARA MODEL RATINGS
// ============================================================================

function useModelRatings() {
    const log = useLogger('ModelRatings');
    const { escuadrillaId } = useUser();

    // Main data query → GET /ratings/model
    const { data: rawData, isLoading, error: queryError, refetch } = useApiQuery<ModelRatingsData>(
        'GET',
        '/ratings/model',
        undefined,
        queryKeys.ratings.model(escuadrillaId ?? 0),
    );
    const data = rawData ?? null;
    const error = queryError?.message ?? null;

    // Process data when it changes
    const [pilotCertifications, setPilotCertifications] = useState<CertificationData>({});
    const [crewCertifications, setCrewCertifications] = useState<CertificationData>({});
    const [personFullNameMap, setPersonFullNameMap] = useState<Record<string, string>>({});
    const [personSkMap, setPersonSkMap] = useState<Record<string, number>>({});
    const [pilots, setPilots] = useState<string[]>([]);
    const [crew, setCrew] = useState<string[]>([]);
    const [pilotRatings, setPilotRatings] = useState<Rating[]>([]);
    const [crewRatings, setCrewRatings] = useState<Rating[]>([]);

    useEffect(() => {
        if (data) {
            const processed = processModelRatings(data);
            setPilotCertifications(processed.pilotCertifications);
            setCrewCertifications(processed.crewCertifications || {});
            setPersonFullNameMap(processed.personFullNameMap);
            setPersonSkMap(processed.personSkMap);
            setPilots(processed.pilots);
            setCrew(processed.crew || []);
            setPilotRatings(processed.pilotRatings);
            setCrewRatings(processed.crewRatings || []);
        }
    }, [data]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRating, setSelectedRating] = useState('Todas las calificaciones');
    const [viewMode, setViewMode] = useState<ViewMode>('pilots');
    const [popoverOpen, setPopoverOpen] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<{ personKey: string; ratingId: number } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Computed values
    const currentPersonnel = viewMode === 'pilots' ? pilots : crew;
    const currentRatings = viewMode === 'pilots' ? pilotRatings : crewRatings;
    const currentCertifications = viewMode === 'pilots' ? pilotCertifications : crewCertifications;

    const filteredPersonnel = (() => {
        return currentPersonnel.filter((personKey) => {
            const fullName = personFullNameMap[personKey]?.toLowerCase() || '';
            const matchesSearch =
                personKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
                fullName.includes(searchTerm.toLowerCase());

            const matchesRating =
                selectedRating === 'Todas las calificaciones' ||
                currentCertifications[personKey]?.[Number(selectedRating)]?.certified;

            return matchesSearch && matchesRating;
        });
    })();

    // Button disabled logic
    const isButtonDisabled = (personKey: string, ratingId: number): boolean => {
        const isPilot = viewMode === 'pilots';
        const certs = isPilot ? pilotCertifications[personKey] : crewCertifications[personKey];

        if (isPilot) {
            // Pilotos: ratings 1-3 mutuamente excluyentes
            if (ratingId <= 3) {
                const otherBasicRatings = [1, 2, 3].filter(id => id !== ratingId);
                const hasOtherBasic = otherBasicRatings.some(id => certs?.[id]?.certified);
                if (hasOtherBasic && !certs?.[ratingId]?.certified) return true;
            }
            // Ratings 4 y 5 requieren rating 3 (HAC)
            if ((ratingId === 4 || ratingId === 5) && !certs?.[3]?.certified) return true;
        } else {
            // Dotaciones: ratings 6-9 mutuamente excluyentes
            if ([6, 7, 8, 9].includes(ratingId)) {
                const otherBasicRatings = [6, 7, 8, 9].filter(id => id !== ratingId);
                const hasOtherBasic = otherBasicRatings.some(id => certs?.[id]?.certified);
                if (hasOtherBasic && !certs?.[ratingId]?.certified) return true;
            }
            // Ratings 10 y 11 requieren rating 9 (CDV)
            if ((ratingId === 10 || ratingId === 11) && !certs?.[9]?.certified) return true;
        }
        return false;
    };

    // Add mutation → POST /ratings/crew
    const addMutation = useApiMutation<{ id: number }, { person_fk: number; crew_ratings_fk: number; date_qualified: string }>(
        'POST',
        '/ratings/crew',
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.model(escuadrillaId)] : [],
        },
    );

    const addCertification = async (personKey: string, ratingId: number, dateQualified: string) => {
        try {
            const personSk = personSkMap[personKey];
            if (!personSk) throw new Error('No se encontró person_sk');

            await addMutation.mutateAsync({
                person_fk: personSk,
                crew_ratings_fk: ratingId,
                date_qualified: dateQualified,
            });

            const setCerts = viewMode === 'pilots' ? setPilotCertifications : setCrewCertifications;
            setCerts(prev => ({
                ...prev,
                [personKey]: {
                    ...prev[personKey],
                    [ratingId]: { certified: true, date_qualified: dateQualified },
                },
            }));

            return true;
        } catch (err) {
            log.error(`Error añadiendo certificación: ${err}`);
            return false;
        }
    };

    // Delete mutation → DELETE /ratings/crew/:id
    const deleteMutation = useApiMutation<void, { crewRatingSk: number }>(
        'DELETE',
        (vars) => `/ratings/crew/${vars.crewRatingSk}`,
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.model(escuadrillaId)] : [],
        },
    );

    const deleteCertification = async (personKey: string, ratingId: number) => {
        try {
            setIsDeleting(true);

            const isPilot = viewMode === 'pilots';
            const persons = isPilot ? data?.todos_pilotos : data?.todas_dotaciones;
            const person = persons?.find(p => p.person_nk === personKey);
            const cal = person?.calificaciones?.find(c => c.crew_ratings_fk === ratingId);

            if (!cal?.crew_rating_sk) throw new Error('No se encontró crew_rating_sk');

            await deleteMutation.mutateAsync({ crewRatingSk: cal.crew_rating_sk });

            const setCerts = isPilot ? setPilotCertifications : setCrewCertifications;
            setCerts(prev => ({
                ...prev,
                [personKey]: {
                    ...prev[personKey],
                    [ratingId]: { certified: false },
                },
            }));

            return true;
        } catch (err) {
            log.error(`Error eliminando certificación: ${err}`);
            return false;
        } finally {
            setIsDeleting(false);
        }
    };

    const refresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    return {
        // Data
        data,
        pilotCertifications,
        crewCertifications,
        personFullNameMap,
        // UI State
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        viewMode,
        setViewMode,
        popoverOpen,
        setPopoverOpen,
        selectedDate,
        setSelectedDate,
        deleteTarget,
        setDeleteTarget,
        isDeleting,
        isRefreshing,
        // Computed
        currentRatings,
        currentCertifications,
        filteredPersonnel,
        // Actions
        refresh,
        addCertification,
        deleteCertification,
        isButtonDisabled,
    };
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface ModelRatingTooltipProps {
    isCertified: boolean;
    dateQualified?: string;
    isDisabled: boolean;
    blockingReason?: string;
    isPilot: boolean;
}

function ModelRatingTooltip({
    isCertified,
    dateQualified,
    isDisabled,
    blockingReason,
    isPilot,
}: ModelRatingTooltipProps) {
    return (
        <div className="space-y-4 max-w-md">
            {isCertified && dateQualified && (
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <div className="flex-1">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                Fecha de obtención:
                            </span>
                            <span className="text-xs ml-2 text-gray-700 dark:text-gray-300">
                                {new Date(dateQualified).toLocaleDateString('es-ES')}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {isDisabled && blockingReason && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-2">
                        <Lock className="w-4 h-4 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 block mb-1">
                                Requisito no cumplido
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                {blockingReason}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {isCertified && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Info className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                {isPilot ? 'Requisitos Pilotos' : 'Requisitos Dotaciones'}
                            </span>
                        </div>
                        {(isPilot ? [
                            'PQM, H2P o HAC: Solo una certificación básica activa',
                            'IP: Requiere ser HAC',
                            'FCP: Requiere ser HAC'
                        ] : [
                            'DA, DR/DAD, DV o CDV: Solo una certificación básica activa',
                            'DI: Requiere ser CDV',
                            'DP: Requiere ser CDV'
                        ]).map((req, idx) => (
                            <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 pl-5 border-l-2 border-gray-300 dark:border-gray-600">
                                {req}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ModelRatings() {
    const hasOperationalPermission = useHasPermission(PermissionLevel.OPERACIONAL);

    const {
        data,
        pilotCertifications,
        crewCertifications,
        personFullNameMap,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        viewMode,
        setViewMode,
        popoverOpen,
        setPopoverOpen,
        selectedDate,
        setSelectedDate,
        deleteTarget,
        setDeleteTarget,
        isDeleting,
        isRefreshing,
        currentRatings,
        currentCertifications,
        filteredPersonnel,
        refresh,
        addCertification,
        deleteCertification,
        isButtonDisabled,
    } = useModelRatings();

    // Obtener razón de bloqueo para tooltip
    const getBlockingReason = (personKey: string, ratingId: number): string | undefined => {
        const isPilot = viewMode === 'pilots';
        const certs = isPilot ? pilotCertifications[personKey] : crewCertifications[personKey];

        if (isPilot) {
            if (ratingId <= 3) {
                const otherRatings = [1, 2, 3].filter(id => id !== ratingId);
                const activeId = otherRatings.find(id => certs?.[id]?.certified);
                if (activeId && !certs?.[ratingId]?.certified) {
                    const activeName = data?.calificaciones_modelo_pilotos.find(
                        r => r.crew_rating_sk === activeId
                    )?.abbreviation;
                    return `Solo puede tener una certificación básica activa (actualmente: ${activeName})`;
                }
            }
            if (ratingId === 4 && !certs?.[3]?.certified) return 'Requiere ser Comandante Piloto (HAC)';
            if (ratingId === 5 && !certs?.[3]?.certified) return 'Requiere ser Comandante Piloto (HAC)';
        } else {
            if ([6, 7, 8, 9].includes(ratingId)) {
                const otherRatings = [6, 7, 8, 9].filter(id => id !== ratingId);
                const activeId = otherRatings.find(id => certs?.[id]?.certified);
                if (activeId && !certs?.[ratingId]?.certified) {
                    const activeName = data?.calificaciones_modelo_dotaciones.find(
                        r => r.crew_rating_sk === activeId
                    )?.abbreviation;
                    return `Solo puede tener una certificación básica activa (actualmente: ${activeName})`;
                }
            }
            if (ratingId === 10 && !certs?.[9]?.certified) return 'Requiere ser Cabeza de Dotación (CDV)';
            if (ratingId === 11 && !certs?.[9]?.certified) return 'Requiere ser Cabeza de Dotación (CDV)';
        }
        return undefined;
    };

    // Render cell
    const renderCell = (personKey: string, rating: Rating) => {
        const cert = currentCertifications[personKey]?.[rating.crew_rating_sk];
        const isCertified = cert?.certified || false;
        const isDisabled = isButtonDisabled(personKey, rating.crew_rating_sk);
        const colorName = MODEL_RATINGS_COLORS[rating.crew_rating_sk] as ColorName || 'gray';
        const popoverKey = `${personKey}-${rating.crew_rating_sk}`;

        return (
            <RatingButton
                isCertified={isCertified}
                isDisabled={isDisabled}
                hasPermission={hasOperationalPermission}
                colorName={colorName}
                popoverOpen={popoverOpen === popoverKey}
                selectedDate={selectedDate}
                onPopoverOpen={() => {
                    setPopoverOpen(popoverKey);
                    setSelectedDate(new Date());
                }}
                onPopoverClose={() => {
                    setPopoverOpen(null);
                    setSelectedDate(undefined);
                }}
                onDateSelect={setSelectedDate}
                onSave={async () => {
                    if (selectedDate) {
                        await addCertification(personKey, rating.crew_rating_sk, formatLocalDate(selectedDate));
                        setPopoverOpen(null);
                        setSelectedDate(undefined);
                    }
                }}
                onClick={() => {
                    if (isCertified) {
                        setDeleteTarget({ personKey, ratingId: rating.crew_rating_sk });
                    }
                }}
                tooltipContent={
                    <ModelRatingTooltip
                        isCertified={isCertified}
                        dateQualified={cert?.date_qualified}
                        isDisabled={isDisabled}
                        blockingReason={getBlockingReason(personKey, rating.crew_rating_sk)}
                        isPilot={viewMode === 'pilots'}
                    />
                }
            />
        );
    };

    // Loading state
    if (isLoading) {
        return <RatingLoading />;
    }

    // Error state
    if (error) {
        return <RatingError error={error} onRetry={() => window.location.reload()} />;
    }

    // No data
    if (!data) {
        return null;
    }

    return (
            <div className="h-full overflow-y-auto p-6 pb-8">
                <div className="w-full mx-auto">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center gap-3 mb-4">
                            <GradientTitle>Calificaciones de Modelo</GradientTitle>
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
                        ratings={currentRatings}
                        colorMap={MODEL_RATINGS_COLORS}
                        searchPlaceholder={`Buscar ${viewMode === 'pilots' ? 'piloto' : 'dotación'}...`}
                        onRefresh={refresh}
                        isRefreshing={isRefreshing}
                    />

                    {/* Table */}
                    <RatingTable
                        personnel={filteredPersonnel}
                        ratings={currentRatings}
                        certifications={currentCertifications}
                        colorMap={MODEL_RATINGS_COLORS}
                        personFullNameMap={personFullNameMap}
                        personColumnLabel={viewMode === 'pilots' ? 'Piloto' : 'Dotación'}
                        renderCell={renderCell}
                    />

                    {/* Delete dialog */}
                    <RatingDeleteDialog
                        deleteTarget={deleteTarget}
                        onClose={() => setDeleteTarget(null)}
                        onConfirm={async () => {
                            if (deleteTarget) {
                                await deleteCertification(deleteTarget.personKey, deleteTarget.ratingId);
                                setDeleteTarget(null);
                            }
                        }}
                        isDeleting={isDeleting}
                        ratings={currentRatings}
                        personFullNameMap={personFullNameMap}
                    />
                </div>
            </div>
    );
}
