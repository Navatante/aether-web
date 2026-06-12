// src/features/ratings/pages/LeadershipRatings.tsx
//
// Página de calificaciones de mando y liderazgo (refactorizada).
// Solo pilotos, sin toggle de vista.

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/logger';
import { Info } from 'lucide-react';
import { PermissionLevel, useHasPermission, useUser } from '@/providers';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { GradientTitle } from '@/shared/components/common';

// Utilidades del feature
import {
    type LeadershipRatingsData,
    type Rating,
    type CertificationData,
    type CertificationStatus,
    processLeadershipRatings,
    LEADERSHIP_COLORS,
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
// HOOK PERSONALIZADO PARA LEADERSHIP RATINGS
// ============================================================================

function useLeadershipRatings() {
    const log = useLogger('LeadershipRatings');
    const { escuadrillaId } = useUser();

    // Main data query → GET /ratings/leadership
    const { data: rawData, isLoading, error: queryError, refetch } = useApiQuery<LeadershipRatingsData>(
        'GET',
        '/ratings/leadership',
        undefined,
        queryKeys.ratings.leadership(escuadrillaId ?? 0),
    );
    const data = rawData ?? null;
    const error = queryError?.message ?? null;

    // Process data when it changes
    const [pilotCertifications, setPilotCertifications] = useState<CertificationData>({});
    const [personFullNameMap, setPersonFullNameMap] = useState<Record<string, string>>({});
    const [personSkMap, setPersonSkMap] = useState<Record<string, number>>({});
    const [pilots, setPilots] = useState<string[]>([]);
    const [ratings, setRatings] = useState<Rating[]>([]);

    useEffect(() => {
        if (data) {
            const processed = processLeadershipRatings(data);
            setPilotCertifications(processed.pilotCertifications);
            setPersonFullNameMap(processed.personFullNameMap);
            setPersonSkMap(processed.personSkMap);
            setPilots(processed.pilots);
            setRatings(processed.pilotRatings);
        }
    }, [data]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRating, setSelectedRating] = useState('Todas las calificaciones');
    const [popoverOpen, setPopoverOpen] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<{ personKey: string; ratingId: number } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filtered personnel
    const filteredPersonnel = (() => {
        return pilots.filter((personKey) => {
            const fullName = personFullNameMap[personKey]?.toLowerCase() || '';
            const matchesSearch =
                personKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
                fullName.includes(searchTerm.toLowerCase());

            const matchesRating =
                selectedRating === 'Todas las calificaciones' ||
                pilotCertifications[personKey]?.[Number(selectedRating)]?.certified;

            return matchesSearch && matchesRating;
        });
    })();

    // Las calificaciones de liderazgo viven en operations.crew_qualification.
    const addMutation = useApiMutation<{ id: number }, { person_fk: number; crew_ratings_fk: number; date_qualified: string }>(
        'POST',
        '/ratings/crew',
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.leadership(escuadrillaId)] : [],
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

            setPilotCertifications(prev => ({
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

    const deleteMutation = useApiMutation<void, { crewRatingSk: number }>(
        'DELETE',
        (vars) => `/ratings/crew/${vars.crewRatingSk}`,
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.leadership(escuadrillaId)] : [],
        },
    );

    const deleteCertification = async (personKey: string, ratingId: number) => {
        try {
            setIsDeleting(true);

            const person = data?.todos_pilotos.find(p => p.person_nk === personKey);
            const cal = person?.calificaciones?.find(c => c.crew_ratings_fk === ratingId);

            if (!cal?.crew_rating_sk) throw new Error('No se encontró crew_rating_sk');

            await deleteMutation.mutateAsync({ crewRatingSk: cal.crew_rating_sk });

            setPilotCertifications(prev => ({
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
        data,
        pilotCertifications,
        personFullNameMap,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        popoverOpen,
        setPopoverOpen,
        selectedDate,
        setSelectedDate,
        deleteTarget,
        setDeleteTarget,
        isDeleting,
        isRefreshing,
        ratings,
        filteredPersonnel,
        refresh,
        addCertification,
        deleteCertification,
    };
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface LeadershipTooltipProps {
    cert: CertificationStatus;
    ratingId: number;
}

function LeadershipTooltip({ cert, ratingId }: LeadershipTooltipProps) {
    const getRatingInfo = (id: number) => {
        switch (id) {
            case 19:
                return {
                    title: 'Líder de Sección',
                    requirements: [
                        'Capaz de dirigir dos o tres helicópteros en AMW y subordinado a un FL.',
                        'Esta calificación es requisito previo para ejercer de HAC en AMW.',
                    ],
                };
            case 20:
                return {
                    title: 'Líder de Formación',
                    requirements: [
                        'Capaz de liderar dos o tres secciones de helicópteros de diferentes escuadrillas y con diferentes cometidos.',
                    ],
                };
            case 21:
                return {
                    title: 'Comandante de Misión Aérea',
                    requirements: [
                        'Capaz de ejercer el mando de todos los medios aéreos involucrados en una operación (RW/FW/UAVs).',
                        'Responsable de la conducción y el cumplimiento del esquema de maniobra (SoM) de la misión aérea.',
                    ],
                };
            default:
                return {
                    title: 'Calificaciones de Mando y Liderazgo',
                    requirements: [
                        'Estas calificaciones representan responsabilidades de mando y liderazgo',
                        'Son independientes de las calificaciones de modelo',
                    ],
                };
        }
    };

    const ratingInfo = getRatingInfo(ratingId);

    return (
        <div className="space-y-4 max-w-md">
            {/* Fecha de calificación */}
            {cert?.certified && cert?.date_qualified && (
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <div className="flex-1">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                Fecha de obtención:
                            </span>
                            <span className="text-xs ml-2 text-gray-700 dark:text-gray-300">
                                {new Date(cert.date_qualified).toLocaleDateString('es-ES')}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Información del rating */}
            {cert?.certified && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Info className="w-3 h-3 text-teal-500" />
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                {ratingInfo.title}
                            </span>
                        </div>
                        {ratingInfo.requirements.map((req, idx) => (
                            <div
                                key={idx}
                                className="text-xs text-gray-600 dark:text-gray-400 pl-5 border-l-2 border-gray-300 dark:border-gray-600"
                            >
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

export default function LeadershipRatings() {
    const hasOperationalPermission = useHasPermission(PermissionLevel.OPERACIONAL);

    const {
        pilotCertifications,
        personFullNameMap,
        isLoading,
        error,
        searchTerm,
        setSearchTerm,
        selectedRating,
        setSelectedRating,
        popoverOpen,
        setPopoverOpen,
        selectedDate,
        setSelectedDate,
        deleteTarget,
        setDeleteTarget,
        isDeleting,
        isRefreshing,
        ratings,
        filteredPersonnel,
        refresh,
        addCertification,
        deleteCertification,
    } = useLeadershipRatings();

    // Render cell
    const renderCell = (personKey: string, rating: Rating) => {
        const cert = pilotCertifications[personKey]?.[rating.crew_rating_sk];
        const isCertified = cert?.certified || false;
        const colorName = LEADERSHIP_COLORS[rating.crew_rating_sk] as ColorName || 'gray';
        const popoverKey = `${personKey}-${rating.crew_rating_sk}`;

        return (
            <RatingButton
                isCertified={isCertified}
                isDisabled={false}
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
                    <LeadershipTooltip
                        cert={cert || { certified: false }}
                        ratingId={rating.crew_rating_sk}
                    />
                }
            />
        );
    };

    if (isLoading) {
        return <RatingLoading message="Cargando calificaciones de liderazgo..." />;
    }

    if (error) {
        return <RatingError error={error} onRetry={() => window.location.reload()} />;
    }

    return (
            <div className="h-full overflow-y-auto p-6 pb-8">
                <div className="w-full mx-auto">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center gap-3 mb-4">
                            <GradientTitle>Calificaciones de Mando y Liderazgo</GradientTitle>
                        </div>
                    </div>

                    {/* Filters */}
                    <RatingFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        selectedRating={selectedRating}
                        onRatingChange={setSelectedRating}
                        ratings={ratings}
                        colorMap={LEADERSHIP_COLORS}
                        searchPlaceholder="Buscar piloto..."
                        onRefresh={refresh}
                        isRefreshing={isRefreshing}
                    />

                    {/* Table */}
                    <RatingTable
                        personnel={filteredPersonnel}
                        ratings={ratings}
                        certifications={pilotCertifications}
                        colorMap={LEADERSHIP_COLORS}
                        personFullNameMap={personFullNameMap}
                        personColumnLabel="Piloto"
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
                        ratings={ratings}
                        personFullNameMap={personFullNameMap}
                    />
                </div>
            </div>
    );
}
