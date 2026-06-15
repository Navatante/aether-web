// Estado y operaciones de la página de calificaciones generales/tácticas.

import { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { useUser } from '@/providers';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import type {
    GeneralTacticalRatingsData,
    Rating,
    CertificationData,
    ViewMode,
} from '../types';
import { processGeneralTacticalRatings } from '../utils/processing';

export function useGeneralTacticalRatings() {
    const log = useLogger('GeneralTacticalRatings');
    const { escuadrillaId } = useUser();

    // Main data query → GET /ratings/general-tactical
    const { data: rawData, isLoading, error: queryError, refetch } = useApiQuery<GeneralTacticalRatingsData>(
        'GET',
        '/ratings/general-tactical',
        undefined,
        queryKeys.ratings.generalTactical(escuadrillaId ?? 0),
    );
    const data = rawData ?? null;
    const error = queryError?.message ?? null;

    // Derivado directo del cache de la query (sin useState/useEffect): el estado
    // de servidor tiene una sola fuente de verdad y el React Compiler memoiza
    // este cálculo. Tras una mutación, invalidateKeys refetchea y esto recomputa.
    const processed = data ? processGeneralTacticalRatings(data) : null;
    const pilotCertifications: CertificationData = processed?.pilotCertifications ?? {};
    const crewCertifications: CertificationData = processed?.crewCertifications ?? {};
    const personFullNameMap: Record<string, string> = processed?.personFullNameMap ?? {};
    const personSkMap: Record<string, number> = processed?.personSkMap ?? {};
    const pilots: string[] = processed?.pilots ?? [];
    const crew: string[] = processed?.crew ?? [];
    const pilotRatings: Rating[] = processed?.pilotRatings ?? [];
    const crewRatings: Rating[] = processed?.crewRatings ?? [];

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

    // Las calificaciones tácticas viven en operations.crew_qualification.
    const addMutation = useApiMutation<{ id: number }, { person_fk: number; crew_ratings_fk: number; date_qualified: string }>(
        'POST',
        '/ratings/crew',
        {
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.generalTactical(escuadrillaId)] : [],
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
            invalidateKeys: escuadrillaId != null ? [queryKeys.ratings.generalTactical(escuadrillaId)] : [],
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
            // El refresco lo hace invalidateKeys (refetch → recomputa el derivado).
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
    };
}
