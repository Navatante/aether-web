// Lógica del formulario de alta/edición de Horas extra. El componente
// RegisterExtraHoursOtrosModelosForm queda solo con el render.

import { useState } from 'react';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { usePersonsNkLookup } from '@/shared/hooks';
import type { ExtraHourItem, InsertResult } from '@/types/generated/extrahours';

interface UseRegisterExtraHoursOtrosModelosArgs {
    mode: 'create' | 'edit';
    initial?: ExtraHourItem;
    onClose: () => void;
}

interface ExtraHoursPayload {
    person: number;
    cta: number;
    day: number;
    convNight: number;
    gvn: number;
    inst: number;
    remarks: string;
}

export function useRegisterExtraHoursOtrosModelos({ mode, initial, onClose }: UseRegisterExtraHoursOtrosModelosArgs) {
    const log = useLogger('RegisterExtraHoursOtrosModelosForm');
    const { id: escId } = useEscuadrilla();

    // Estado del formulario (las horas como string para el input; se parsean al enviar).
    const [person, setPerson] = useState<number | null>(initial?.personSk ?? null);
    const [cta, setCta] = useState<string>(initial ? String(initial.cta) : '0');
    const [day, setDay] = useState<string>(initial ? String(initial.day) : '0');
    const [convNight, setConvNight] = useState<string>(initial ? String(initial.convNight) : '0');
    const [gvn, setGvn] = useState<string>(initial ? String(initial.gvn) : '0');
    const [inst, setInst] = useState<string>(initial ? String(initial.inst) : '0');
    const [remarks, setRemarks] = useState<string>(initial?.remarks ?? '');
    const [error, setError] = useState<string | null>(null);

    const { data: personArray, loading: personsLoading, error: personsError } = usePersonsNkLookup();

    // Alta. El toast de error lo gestiona useApiMutation; el de éxito se hace a mano.
    const createMutation = useApiMutation<InsertResult, ExtraHoursPayload>(
        'POST', '/extra-hours',
        { invalidateKeys: [queryKeys.extraHoursOtrosModelos.all(escId ?? 0)] },
    );
    // Edición. El id viaja en vars pero NO en el body (selector body).
    const updateMutation = useApiMutation<void, ExtraHoursPayload & { id: number }>(
        'PUT', (v) => `/extra-hours/${v.id}`,
        {
            invalidateKeys: [queryKeys.extraHoursOtrosModelos.all(escId ?? 0)],
            successMessage: 'Horas extra actualizadas.',
            body: ({ id: _id, ...rest }) => rest,
        },
    );

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const canSubmit = person != null && !isSubmitting;

    const parseNum = (s: string) => parseFloat(s.replace(',', '.'));

    const handleSubmit = async () => {
        setError(null);
        if (person == null) {
            setError('Selecciona una persona.');
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
        const payload: ExtraHoursPayload = { person, ...nums, remarks: remarks.trim() };
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
        person, setPerson,
        cta, setCta, day, setDay, convNight, setConvNight, gvn, setGvn, inst, setInst,
        remarks, setRemarks,
        error, isSubmitting, canSubmit, mode,
        // lookups
        personArray, personsLoading, personsError,
        // acciones
        handleSubmit,
    };
}
