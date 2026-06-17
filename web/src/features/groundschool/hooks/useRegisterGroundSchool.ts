// Lógica del formulario de alta de Ground School. El componente
// RegisterGroundSchoolForm queda solo con el render.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { useGroundSchoolPapeletasLookup, usePersonsNkLookup } from '@/shared/hooks';
import type { InsertResult } from '@/types/generated/groundschool';

interface UseRegisterGroundSchoolArgs {
    onClose: () => void;
}

export function useRegisterGroundSchool({ onClose }: UseRegisterGroundSchoolArgs) {
    const log = useLogger('RegisterGroundSchoolForm');
    const navigate = useNavigate();
    const { id: escId } = useEscuadrilla();

    // Estado del formulario.
    const [date, setDate] = useState<string>(''); // "YYYY-MM-DD"
    const [papeleta, setPapeleta] = useState<string>('');
    const [persons, setPersons] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Lookups.
    const {
        data: papeletaArray,
        loading: papeletasLoading,
        error: papeletasError,
    } = useGroundSchoolPapeletasLookup();
    const {
        data: personArray,
        loading: personsLoading,
        error: personsError,
    } = usePersonsNkLookup();

    // Alta. Invalida todo el dominio de ground school de la escuadrilla; el
    // toast de error lo gestiona useApiMutation.
    const createGroundSchool = useApiMutation<
        InsertResult,
        { date: string; papeleta: number; persons: number[] }
    >('POST', '/ground-school', {
        invalidateKeys: [queryKeys.groundSchool.all(escId ?? 0)],
    });

    const isSubmitting = createGroundSchool.isPending;
    const canSubmit = !!date && !!papeleta && persons.length > 0 && !isSubmitting;

    const togglePerson = (personSk: number) => {
        setPersons((prev) =>
            prev.includes(personSk) ? prev.filter((p) => p !== personSk) : [...prev, personSk],
        );
    };

    const removePerson = (personSk: number) => {
        setPersons((prev) => prev.filter((p) => p !== personSk));
    };

    const handleSubmit = async () => {
        setError(null);
        if (!date || !papeleta || persons.length === 0) {
            setError('Completa la fecha, papeleta y al menos una persona.');
            return;
        }
        try {
            const result = await createGroundSchool.mutateAsync({
                date,
                papeleta: parseInt(papeleta, 10),
                persons,
            });
            if (result.success) {
                toast.success(result.message);
                onClose();
                navigate('/ground-school');
            } else {
                toast.error('Error al registrar el Ground School');
            }
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al registrar Ground School: ${err}`);
        }
    };

    return {
        // estado
        date,
        setDate,
        papeleta,
        setPapeleta,
        persons,
        togglePerson,
        removePerson,
        error,
        isSubmitting,
        canSubmit,
        // lookups
        papeletaArray,
        papeletasLoading,
        papeletasError,
        personArray,
        personsLoading,
        personsError,
        // acciones
        handleSubmit,
    };
}
