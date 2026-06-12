// src/features/ratings/pages/MaintenanceRatings.tsx
//
// Página de calificaciones de mantenimiento (refactorizada).
// Usa full_name como key y permisos ADMINISTRATIVO.

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/logger';
import { PermissionLevel, useHasPermission, useUser } from '@/providers';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import {
    GradientTitle,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
} from '@/shared/components/common';

// Utilidades del feature
import {
    type MaintenanceRatingsData,
    type Rating,
    type CertificationData,
    processMaintenanceRatings,
    MAINTENANCE_COLORS,
    formatLocalDate,
    COLOR_PALETTE,
} from '..';
import type { ColorName } from '../utils/colors';

// Componentes del feature
import {
    RatingButton,
    RatingFilters,
    RatingDeleteDialog,
    RatingLoading,
    RatingError,
} from '../components';

// ============================================================================
// HOOK PERSONALIZADO PARA MAINTENANCE RATINGS
// ============================================================================

function useMaintenanceRatings() {
    const log = useLogger('MaintenanceRatings');
    const { escuadrillaId } = useUser();

    // Main data query → GET /ratings/maintenance
    const { data: rawData, isLoading, error: queryError, refetch } = useApiQuery<MaintenanceRatingsData>(
        'GET',
        '/ratings/maintenance',
        undefined,
        queryKeys.ratings.maintenance(escuadrillaId ?? 0),
    );
    const data = rawData ?? null;
    const error = queryError?.message ?? null;

    // Process data when it changes
    const [certifications, setCertifications] = useState<CertificationData>({});
    const [personFullNameMap, setPersonFullNameMap] = useState<Record<string, string>>({});
    const [personSkMap, setPersonSkMap] = useState<Record<string, number>>({});
    const [personnel, setPersonnel] = useState<string[]>([]);
    const [ratings, setRatings] = useState<Rating[]>([]);

    useEffect(() => {
        if (data) {
            const processed = processMaintenanceRatings(data);
            setCertifications(processed.pilotCertifications); // Uses pilotCertifications for storage
            setPersonFullNameMap(processed.personFullNameMap);
            setPersonSkMap(processed.personSkMap);
            setPersonnel(processed.pilots); // Uses pilots array for personnel
            setRatings(processed.pilotRatings); // Converted ratings
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
        return personnel.filter((personKey) => {
            const fullName = personFullNameMap[personKey]?.toLowerCase() || '';
            const matchesSearch =
                personKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
                fullName.includes(searchTerm.toLowerCase());

            const matchesRating =
                selectedRating === 'Todas las calificaciones' ||
                certifications[personKey]?.[Number(selectedRating)]?.certified;

            return matchesSearch && matchesRating;
        });
    })();

    // Las calificaciones de mantenimiento viven en detall.notcrew_qualification.
    const addMutation = useApiMutation<{ id: number }, { person_fk: number; crew_ratings_fk: number; date_qualified: string }>(
        'POST',
        '/ratings/not-crew',
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.maintenance(escuadrillaId)] : [],
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

            setCertifications(prev => ({
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

    const deleteMutation = useApiMutation<void, { notCrewRatingsSk: number }>(
        'DELETE',
        (vars) => `/ratings/not-crew/${vars.notCrewRatingsSk}`,
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.maintenance(escuadrillaId)] : [],
        },
    );

    const deleteCertification = async (personKey: string, ratingId: number) => {
        try {
            setIsDeleting(true);

            const person = data?.todos_mantenedores.find(p => p.full_name === personKey);
            const cal = person?.calificaciones?.find(c => c.notCrew_rating_fk === ratingId);

            if (!cal?.notCrew_ratings_sk) throw new Error('No se encontró notCrew_ratings_sk');

            await deleteMutation.mutateAsync({ notCrewRatingsSk: cal.notCrew_ratings_sk });

            setCertifications(prev => ({
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
        certifications,
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
// CUSTOM TABLE COMPONENT (sin tooltip en nombre, usa full_name directamente)
// ============================================================================

interface MaintenanceTableProps {
    personnel: string[];
    ratings: Rating[];
    certifications: CertificationData;
    colorMap: Record<number, ColorName>;
    renderCell: (personKey: string, rating: Rating) => React.ReactNode;
}

function MaintenanceTable({
    personnel,
    ratings,
    colorMap,
    renderCell,
}: MaintenanceTableProps) {
    return (
        <PageTableContainer>
            <table className="w-full" role="table">
                <StickyTableHeader offset="topbar">
                    <tr>
                        <th className="text-left p-4 font-semibold text-table-header-foreground">Mantenedor</th>
                        {ratings.map((rating) => {
                            const colorName = colorMap[rating.crew_rating_sk] || 'gray';
                            const color = COLOR_PALETTE[colorName];
                            return (
                                <th
                                    key={rating.crew_rating_sk}
                                    className="text-center p-4 min-w-[120px]"
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`${color.text} font-bold text-lg`}>
                                            {rating.abbreviation}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-normal">
                                            {rating.name}
                                        </span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </StickyTableHeader>
                <tbody>
                    {personnel.map((personKey, idx) => (
                        <TableRow
                            key={personKey}
                            index={idx}
                            className="cursor-default"
                        >
                            <td className="p-4">
                                <span className="font-medium text-lg text-foreground">
                                    {personKey}
                                </span>
                            </td>
                            {ratings.map((rating) => (
                                <td key={rating.crew_rating_sk} className="text-center p-4">
                                    {renderCell(personKey, rating)}
                                </td>
                            ))}
                        </TableRow>
                    ))}
                </tbody>
            </table>
        </PageTableContainer>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaintenanceRatings() {
    const hasAdministrativePermission = useHasPermission(PermissionLevel.ADMINISTRATIVO);

    const {
        certifications,
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
    } = useMaintenanceRatings();

    // Render cell
    const renderCell = (personKey: string, rating: Rating) => {
        const cert = certifications[personKey]?.[rating.crew_rating_sk];
        const isCertified = cert?.certified || false;
        const colorName = MAINTENANCE_COLORS[rating.crew_rating_sk] as ColorName || 'gray';
        const popoverKey = `${personKey}-${rating.crew_rating_sk}`;

        return (
            <RatingButton
                isCertified={isCertified}
                isDisabled={false}
                hasPermission={hasAdministrativePermission}
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
            />
        );
    };

    if (isLoading) {
        return <RatingLoading message="Cargando calificaciones de mantenimiento..." />;
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
                            <GradientTitle>Calificaciones de Mantenimiento</GradientTitle>
                        </div>
                    </div>

                    {/* Filters */}
                    <RatingFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        selectedRating={selectedRating}
                        onRatingChange={setSelectedRating}
                        ratings={ratings}
                        colorMap={MAINTENANCE_COLORS}
                        searchPlaceholder="Buscar mantenedor..."
                        onRefresh={refresh}
                        isRefreshing={isRefreshing}
                    />

                    {/* Table */}
                    <MaintenanceTable
                        personnel={filteredPersonnel}
                        ratings={ratings}
                        certifications={certifications}
                        colorMap={MAINTENANCE_COLORS}
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
