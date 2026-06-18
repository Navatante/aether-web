// Lógica del formulario de alta/edición de Horas extra del modelo (NH-90).
// El componente RegisterExtraModelHoursForm queda solo con el render.

import { useState } from 'react';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { usePersonsNkLookup } from '@/shared/hooks';
import type { ExtraModelHourItem, InsertResult } from '@/types/generated/extramodelhours';

interface UseRegisterExtraModelHoursArgs {
    mode: 'create' | 'edit';
    initial?: ExtraModelHourItem;
    onClose: () => void;
}

interface ExtraModelHoursPayload {
    person: number;
    date: string;
    isReal: boolean;
    cta: number;
    day: number;
    convNight: number;
    gvn: number;
    inst: number;
    remarks: string;
}

export function useRegisterExtraModelHours({ mode, initial, onClose }: UseRegisterExtraModelHoursArgs) {
    const log = useLogger('RegisterExtraModelHoursForm');
    const { id: escId } = useEscuadrilla();

    // Estado del formulario (las horas como string para el input; se parsean al enviar).
    const [person, setPerson] = useState<number | null>(initial?.personSk ?? null);
    const [date, setDate] = useState<string>(initial?.date ?? '');
    const [isReal, setIsReal] = useState<boolean>(initial?.isReal ?? true);
    const [cta, setCta] = useState<string>(initial ? String(initial.cta) : '0');
    const [day, setDay] = useState<string>(initial ? String(initial.day) : '0');
    const [convNight, setConvNight] = useState<string>(initial ? String(initial.convNight) : '0');
    const [gvn, setGvn] = useState<string>(initial ? String(initial.gvn) : '0');
    const [inst, setInst] = useState<string>(initial ? String(initial.inst) : '0');
    const [remarks, setRemarks] = useState<string>(initial?.remarks ?? '');
    const [error, setError] = useState<string | null>(null);

    const { data: personArray, loading: personsLoading, error: personsError } = usePersonsNkLookup();

    const createMutation = useApiMutation<InsertResult, ExtraModelHoursPayload>(
        'POST', '/extra-model-hours',
        { invalidateKeys: [queryKeys.extraModelHours.all(escId ?? 0)] },
    );
    const updateMutation = useApiMutation<void, ExtraModelHoursPayload & { id: number }>(
        'PUT', (v) => `/extra-model-hours/${v.id}`,
        {
            invalidateKeys: [queryKeys.extraModelHours.all(escId ?? 0)],
            successMessage: 'Horas de modelo actualizadas.',
            body: ({ id: _id, ...rest }) => rest,
        },
    );

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const canSubmit = person != null && !!date && !isSubmitting;

    const parseNum = (s: string) => parseFloat(s.replace(',', '.'));

    const handleSubmit = async () => {
        setError(null);
        if (person == null) {
            setError('Selecciona una persona.');
            return;
        }
        if (!date) {
            setError('Selecciona una fecha.');
            return;
        }
        const nums = {
            cta: parseNum(cta), day: parseNum(day), convNight: parseNum(convNight),
            gvn: parseNum(gvn), inst: parseNum(inst),
        };
        if (Object.values(nums).some((v) => Number.isNaN(v) || v < 0)) {
            setError('Las horas deben ser números no negativos.');
            return;
        }
        const payload: ExtraModelHoursPayload = { person, date, isReal, ...nums, remarks: remarks.trim() };
        try {
            if (mode === 'edit' && initial) {
                await updateMutation.mutateAsync({ id: initial.id, ...payload });
            } else {
                const result = await createMutation.mutateAsync(payload);
                if (!result.success) {
                    toast.error('Error al registrar las horas de modelo');
                    return;
                }
                toast.success(result.message);
            }
            onClose();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al guardar horas de modelo: ${err}`);
        }
    };

    return {
        // estado
        person, setPerson, date, setDate, isReal, setIsReal,
        cta, setCta, day, setDay, convNight, setConvNight, gvn, setGvn, inst, setInst,
        remarks, setRemarks,
        error, isSubmitting, canSubmit, mode,
        // lookups
        personArray, personsLoading, personsError,
        // acciones
        handleSubmit,
    };
}
