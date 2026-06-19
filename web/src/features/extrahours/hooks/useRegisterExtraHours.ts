// Lógica del formulario de alta/edición de Horas extra (tabla unificada).
// El componente RegisterExtraHoursForm queda solo con el render.

import { useState } from 'react';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { usePersonsNkLookup, useAircraftModels } from '@/shared/hooks';
import type { ExtraHourItem, InsertResult } from '@/types/generated/extrahours';

interface UseRegisterExtraHoursArgs {
    mode: 'create' | 'edit';
    initial?: ExtraHourItem;
    onClose: () => void;
}

interface ExtraHoursPayload {
    person: number;
    date: string;
    model: number;
    isReal: boolean;
    cta: number;
    day: number;
    convNight: number;
    gvn: number;
    inst: number;
    remarks: string;
}

export function useRegisterExtraHours({ mode, initial, onClose }: UseRegisterExtraHoursArgs) {
    const log = useLogger('RegisterExtraHoursForm');
    const { id: escId } = useEscuadrilla();

    // Estado del formulario (las horas como string para el input; se parsean al enviar).
    const [person, setPerson] = useState<number | null>(initial?.personSk ?? null);
    const [date, setDate] = useState<string>(initial?.date ?? '');
    const [model, setModel] = useState<number | null>(initial?.modelSk ?? null);
    const [isReal, setIsReal] = useState<boolean>(initial?.isReal ?? true);
    const [cta, setCta] = useState<string>(initial ? String(initial.cta) : '0');
    const [day, setDay] = useState<string>(initial ? String(initial.day) : '0');
    const [convNight, setConvNight] = useState<string>(initial ? String(initial.convNight) : '0');
    const [gvn, setGvn] = useState<string>(initial ? String(initial.gvn) : '0');
    const [inst, setInst] = useState<string>(initial ? String(initial.inst) : '0');
    const [remarks, setRemarks] = useState<string>(initial?.remarks ?? '');
    const [error, setError] = useState<string | null>(null);

    const { data: personArray, loading: personsLoading, error: personsError } = usePersonsNkLookup();
    const { data: modelArray, loading: modelsLoading } = useAircraftModels();

    const createMutation = useApiMutation<InsertResult, ExtraHoursPayload>(
        'POST', '/extra-hours',
        { invalidateKeys: [queryKeys.extraHours.all(escId ?? 0)] },
    );
    const updateMutation = useApiMutation<void, ExtraHoursPayload & { id: number }>(
        'PUT', (v) => `/extra-hours/${v.id}`,
        {
            invalidateKeys: [queryKeys.extraHours.all(escId ?? 0)],
            successMessage: 'Horas extra actualizadas.',
            body: ({ id: _id, ...rest }) => rest,
        },
    );

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const canSubmit = person != null && !!date && model != null && !isSubmitting;

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
        if (model == null) {
            setError('Selecciona un modelo de aeronave.');
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
        const payload: ExtraHoursPayload = { person, date, model, isReal, ...nums, remarks: remarks.trim() };
        try {
            if (mode === 'edit' && initial) {
                await updateMutation.mutateAsync({ id: initial.id, ...payload });
            } else {
                const result = await createMutation.mutateAsync(payload);
                if (!result.success) {
                    toast.error('Error al registrar las horas extra');
                    return;
                }
                toast.success(result.message);
            }
            onClose();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al guardar horas extra: ${err}`);
        }
    };

    return {
        // estado
        person, setPerson, date, setDate, model, setModel, isReal, setIsReal,
        cta, setCta, day, setDay, convNight, setConvNight, gvn, setGvn, inst, setInst,
        remarks, setRemarks,
        error, isSubmitting, canSubmit, mode,
        // lookups
        personArray, personsLoading, personsError,
        modelArray, modelsLoading,
        // acciones
        handleSubmit,
    };
}
