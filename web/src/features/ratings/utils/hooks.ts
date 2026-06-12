// src/features/ratings/utils/hooks.ts
//
// Hook genérico para manejo de ratings.
// Encapsula estado, fetching, y operaciones CRUD comunes.

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/logger';
import { http } from '@/lib/http';
import type {
    CertificationData,
    Rating,
    ViewMode,
    DeleteTarget,
    ProcessedRatingData,
    UseRatingsReturn,
} from '../types';
import { filterPersonnel } from './processing';

// ============================================================================
// HOOK CONFIGURATION
// ============================================================================

export interface UseRatingsConfig<TData> {
    /** Path HTTP para GET (ej. '/ratings/model') */
    fetchPath: string;
    /** Path HTTP para POST (ej. '/ratings/crew' o '/ratings/not-crew') */
    addPath: string;
    /** Path HTTP base para DELETE; el sk se añade al final (ej. '/ratings/crew') */
    deletePath: string;
    /** Función para procesar los datos crudos */
    processData: (data: TData) => ProcessedRatingData;
    /** Si soporta vista dual (pilots/crew) */
    hasViewModeToggle: boolean;
    /** Función para obtener el person_sk dado el personKey */
    getPersonSk?: (data: TData, personKey: string, viewMode: ViewMode) => number | undefined;
    /** Función para obtener el crew_rating_sk para eliminar */
    getCrewRatingSk?: (data: TData, personKey: string, ratingId: number, viewMode: ViewMode) => number | undefined;
}

// ============================================================================
// USE RATINGS HOOK
// ============================================================================

export function useRatings<TData>(
    config: UseRatingsConfig<TData>
): UseRatingsReturn<TData> {
    const log = useLogger('useRatingsData');

    // ========================================================================
    // STATE
    // ========================================================================

    // Data state
    const [data, setData] = useState<TData | null>(null);
    const [pilotCertifications, setPilotCertifications] = useState<CertificationData>({});
    const [crewCertifications, setCrewCertifications] = useState<CertificationData>({});
    const [personFullNameMap, setPersonFullNameMap] = useState<Record<string, string>>({});
    const [personSkMap, setPersonSkMap] = useState<Record<string, number>>({});

    // UI state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedRating, setSelectedRating] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('pilots');
    const [popoverOpen, setPopoverOpen] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Processed data refs
    const [pilots, setPilots] = useState<string[]>([]);
    const [crew, setCrew] = useState<string[]>([]);
    const [pilotRatings, setPilotRatings] = useState<Rating[]>([]);
    const [crewRatings, setCrewRatings] = useState<Rating[]>([]);

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await http<TData>('GET', config.fetchPath);

            if (response) {
                setData(response);

                const processed = config.processData(response);

                setPilotCertifications(processed.pilotCertifications);
                setCrewCertifications(processed.crewCertifications || {});
                setPersonFullNameMap(processed.personFullNameMap);
                setPersonSkMap(processed.personSkMap);
                setPilots(processed.pilots);
                setCrew(processed.crew || []);
                setPilotRatings(processed.pilotRatings);
                setCrewRatings(processed.crewRatings || []);
            }
        } catch (err) {
            log.error(`Error cargando ${config.fetchPath}: ${err}`);
            setError(err instanceof Error ? err.message : 'Error desconocido al cargar los datos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================

    const currentPersonnel = viewMode === 'pilots' ? pilots : crew;

    const currentRatings = viewMode === 'pilots' ? pilotRatings : crewRatings;

    const currentCertifications = viewMode === 'pilots' ? pilotCertifications : crewCertifications;

    const filteredPersonnel = filterPersonnel(
        currentPersonnel,
        currentCertifications,
        searchTerm,
        selectedRating,
        personFullNameMap
    );

    // ========================================================================
    // ACTIONS
    // ========================================================================

    const refresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
    };

    const addCertification = async (
        personKey: string,
        ratingId: number,
        dateQualified: string
    ): Promise<boolean> => {
        try {
            const personSk = personSkMap[personKey];
            if (!personSk) {
                throw new Error('No se encontró person_sk');
            }

            // Backend espera snake_case en el body.
            await http('POST', config.addPath, {
                body: {
                    person_fk: personSk,
                    crew_ratings_fk: ratingId,
                    date_qualified: dateQualified,
                },
            });

            // Actualizar estado local
            const setCertifications = viewMode === 'pilots'
                ? setPilotCertifications
                : setCrewCertifications;

            setCertifications(prev => ({
                ...prev,
                [personKey]: {
                    ...prev[personKey],
                    [ratingId]: {
                        certified: true,
                        date_qualified: dateQualified,
                    },
                },
            }));

            // Recargar datos para obtener el crew_rating_sk actualizado
            await loadData();

            return true;
        } catch (err) {
            log.error(`Error añadiendo certificación: ${err}`);
            return false;
        }
    };

    const deleteCertification = async (
        personKey: string,
        ratingId: number
    ): Promise<boolean> => {
        try {
            setIsDeleting(true);

            // Buscar el crew_rating_sk en los datos
            let crewRatingSk: number | undefined;

            if (config.getCrewRatingSk && data) {
                crewRatingSk = config.getCrewRatingSk(data, personKey, ratingId, viewMode);
            }

            if (!crewRatingSk) {
                throw new Error('No se encontró crew_rating_sk para eliminar');
            }

            // DELETE /ratings/{crew,not-crew}/:id (sk en URL)
            await http('DELETE', `${config.deletePath}/${crewRatingSk}`);

            // Actualizar estado local
            const setCertifications = viewMode === 'pilots'
                ? setPilotCertifications
                : setCrewCertifications;

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

    // ========================================================================
    // RETURN
    // ========================================================================

    return {
        // Estado de datos
        data,
        pilotCertifications,
        crewCertifications,
        personFullNameMap,
        personSkMap,

        // Estado de UI
        isLoading,
        error,
        searchTerm,
        selectedRating,
        viewMode,
        popoverOpen,
        selectedDate,
        deleteTarget,
        isDeleting,
        isRefreshing,

        // Datos computados
        currentPersonnel,
        currentRatings,
        currentCertifications,
        filteredPersonnel,

        // Acciones
        setSearchTerm,
        setSelectedRating,
        setViewMode,
        setPopoverOpen,
        setSelectedDate,
        setDeleteTarget,
        refresh,
        addCertification,
        deleteCertification,
    };
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook para manejar la lógica del popover de fecha.
 */
export function useDatePopover() {
    const [popoverOpen, setPopoverOpen] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    const openPopover = (key: string) => {
        setPopoverOpen(key);
        setSelectedDate(new Date());
    };

    const closePopover = () => {
        setPopoverOpen(null);
        setSelectedDate(undefined);
    };

    return {
        popoverOpen,
        selectedDate,
        setSelectedDate,
        openPopover,
        closePopover,
    };
}

/**
 * Hook para manejar la lógica de eliminación con confirmación.
 */
export function useDeleteConfirmation() {
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const confirmDelete = (personKey: string, ratingId: number) => {
        setDeleteTarget({ personKey, ratingId });
    };

    const cancelDelete = () => {
        setDeleteTarget(null);
    };

    return {
        deleteTarget,
        isDeleting,
        setIsDeleting,
        confirmDelete,
        cancelDelete,
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formatea una fecha para enviar al backend (YYYY-MM-DD).
 */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
