// src/features/ratings/pages/GeneralTacticalRatings.tsx
//
// Página de calificaciones generales y tácticas. La lógica vive en
// hooks/useGeneralTacticalRatings; el tooltip en components/GeneralTacticalTooltip.

import { PermissionLevel, useHasPermission } from '@/providers';
import ViewModeTogglePilotsDvs from '../components/ViewModeTogglePilotsDvs';
import { GradientTitle } from '@/shared/components/common';
import { type Rating, GENERAL_TACTICAL_COLORS, formatLocalDate } from '..';
import type { ColorName } from '../utils/colors';
import { useGeneralTacticalRatings } from '../hooks/useGeneralTacticalRatings';
import { GeneralTacticalTooltip } from '../components/GeneralTacticalTooltip';
import {
    RatingButton,
    RatingFilters,
    RatingDeleteDialog,
    RatingTable,
    RatingLoading,
    RatingError,
} from '../components';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GeneralTacticalRatings() {
    const hasOperationalPermission = useHasPermission(PermissionLevel.OPERACIONAL);

    const {
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
    } = useGeneralTacticalRatings();

    // Render cell
    const renderCell = (personKey: string, rating: Rating) => {
        const cert = currentCertifications[personKey]?.[rating.crew_rating_sk];
        const isCertified = cert?.certified || false;
        const colorName = GENERAL_TACTICAL_COLORS[rating.crew_rating_sk] as ColorName || 'gray';
        const popoverKey = `${personKey}-${rating.crew_rating_sk}`;
        const isPilot = viewMode === 'pilots';

        return (
            <RatingButton
                isCertified={isCertified}
                isDisabled={false}
                hasPermission={hasOperationalPermission}
                colorName={colorName}
                state={cert?.state as 'valid' | 'warning' | 'expired' | undefined}
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
                    <GeneralTacticalTooltip
                        cert={cert || { certified: false }}
                        ratingId={rating.crew_rating_sk}
                        isPilot={isPilot}
                    />
                }
            />
        );
    };

    if (isLoading) {
        return <RatingLoading />;
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
                            <GradientTitle>Calificaciones Generales y Tácticas</GradientTitle>
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
                        colorMap={GENERAL_TACTICAL_COLORS}
                        searchPlaceholder={`Buscar ${viewMode === 'pilots' ? 'piloto' : 'dotación'}...`}
                        onRefresh={refresh}
                        isRefreshing={isRefreshing}
                    />

                    {/* Table */}
                    <RatingTable
                        personnel={filteredPersonnel}
                        ratings={currentRatings}
                        certifications={currentCertifications}
                        colorMap={GENERAL_TACTICAL_COLORS}
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
