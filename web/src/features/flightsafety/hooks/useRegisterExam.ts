// Lógica del formulario de alta / programación / registro de un reconocimiento
// de Seguridad de vuelo (médico, dunker, hiperbárica). El componente ExamForm
// queda solo con el render.
//
// Un mismo formulario cubre dos fases del ciclo de vida:
//   - 'programado': solo fecha de la cita (+ lugar en médico).
//   - 'realizado' : fecha + caducidad (auto, editable) + resultado (+ lugar en médico).
// En modo edición sirve para "registrar resultado" de una cita programada o
// editar un registro existente.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { usePersonsLookup, useMedicalExamPlaces, useMedicalExamResults } from '@/shared/hooks';
import type { InsertResult, MedicalPayload, ExamPayload } from '@/types/generated/flightsafety';
import { EXAM_CONFIG, computeExpiry, type ExamType } from '../flightsafety';

export type ExamPhase = 'programado' | 'realizado';

// Resultado booleano de dunker/hiperbárica como string para el <Select>.
export type BoolResult = 'apto' | 'no_apto' | 'na';

export interface ExamDialogInitial {
    id: number;
    personSk: number;
    date?: string;
    scheduledDate?: string;
    expiryDate?: string;
    remark?: string;
    /** Lugar ya fijado en la cita (médico); reutilizado al registrar el resultado. */
    scheduledPlaceFk?: number;
    /** Datos del registro realizado a preseleccionar al editar (médico). */
    placeFk?: number;
    resultFk?: number;
    /** Resultado booleano a preseleccionar al editar (dunker/hiperbárica). */
    boolResult?: BoolResult;
}

export type ExamMode = 'create' | 'edit' | 'complete';

interface UseRegisterExamArgs {
    type: ExamType;
    // 'complete' = registrar el resultado de una cita ya programada: fecha,
    // caducidad y lugar se toman de la cita; el usuario solo indica resultado
    // (y observaciones en médico).
    mode: ExamMode;
    initial?: ExamDialogInitial;
    /** Persona preseleccionada al programar/registrar desde una fila. */
    initialPersonSk?: number;
    onClose: () => void;
    onSuccess?: () => void;
}

function resultToBool(r: BoolResult): boolean | undefined {
    if (r === 'apto') return true;
    if (r === 'no_apto') return false;
    return undefined;
}

/** Inverso de resultToBool: del booleano del backend al valor del <Select>. */
export function boolToResult(b: boolean | undefined): BoolResult {
    if (b === true) return 'apto';
    if (b === false) return 'no_apto';
    return 'na';
}

export function useRegisterExam({ type, mode, initial, initialPersonSk, onClose, onSuccess }: UseRegisterExamArgs) {
    const log = useLogger('FlightSafetyForm');
    const { id: escId } = useEscuadrilla();
    const cfg = EXAM_CONFIG[type];
    const isMedical = type === 'medical';

    const isComplete = mode === 'complete';

    // Fase determinada por el modo: un alta siempre nace PROGRAMADA; editar y
    // registrar resultado operan sobre un REALIZADO. No es elegible por el usuario.
    const phase: ExamPhase = mode === 'create' ? 'programado' : 'realizado';

    // Estado del formulario.
    const [personSk, setPersonSk] = useState<number | null>(initial?.personSk ?? initialPersonSk ?? null);
    const [scheduledDate, setScheduledDate] = useState<string>(initial?.scheduledDate ?? '');
    const [date, setDate] = useState<string>(initial?.date ?? '');
    const [expiry, setExpiry] = useState<string>(initial?.expiryDate ?? '');
    // Al editar se preselecciona el lugar del realizado; en 'complete' se hereda
    // de la cita; si ninguno aplica queda null y el form lo pide.
    const [placeFk, setPlaceFk] = useState<number | null>(
        initial?.placeFk && initial.placeFk > 0 ? initial.placeFk
            : initial?.scheduledPlaceFk && initial.scheduledPlaceFk > 0 ? initial.scheduledPlaceFk
                : null,
    );
    const [resultFk, setResultFk] = useState<number | null>(
        initial?.resultFk && initial.resultFk > 0 ? initial.resultFk : null,
    );
    const [boolResult, setBoolResult] = useState<BoolResult>(initial?.boolResult ?? 'apto');
    const [remark, setRemark] = useState<string>(initial?.remark ?? '');
    const [error, setError] = useState<string | null>(null);

    // Caducidad auto-sugerida al fijar la fecha de realización (editable).
    const [expiryTouched, setExpiryTouched] = useState(false);
    useEffect(() => {
        if (phase !== 'realizado' || expiryTouched) return;
        setExpiry(date ? computeExpiry(date, type) : '');
    }, [date, phase, type, expiryTouched]);

    // Lookups.
    const { data: persons, loading: personsLoading } = usePersonsLookup();
    const { data: places, loading: placesLoading } = useMedicalExamPlaces();
    const { data: results, loading: resultsLoading } = useMedicalExamResults();

    // Sub-form "nuevo lugar" (solo médico).
    const [addingPlace, setAddingPlace] = useState(false);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [pendingPlaceName, setPendingPlaceName] = useState<string | null>(null);
    useEffect(() => {
        if (!pendingPlaceName) return;
        const created = places.find((p) => p.medical_exam_place === pendingPlaceName);
        if (created) {
            setPlaceFk(created.medical_exam_place_sk);
            setPendingPlaceName(null);
        }
    }, [places, pendingPlaceName]);

    const invalidate = { invalidateKeys: [queryKeys.flightSafety.all(escId ?? 0)] };
    const createMutation = useApiMutation<InsertResult, MedicalPayload | ExamPayload>('POST', cfg.apiPath, invalidate);
    const updateMutation = useApiMutation<void, (MedicalPayload | ExamPayload) & { id: number }>(
        'PUT', (v) => `${cfg.apiPath}/${v.id}`,
        { ...invalidate, successMessage: 'Reconocimiento actualizado.', body: ({ id: _id, ...rest }) => rest },
    );
    const addPlace = useApiMutation<void, { medical_exam_place: string }>(
        'POST', '/lookups/medical-exam-places',
        { invalidateKeys: [queryKeys.lookups.medicalExamPlaces(escId ?? 0)] },
    );

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const canSubmit = (() => {
        if (personSk == null || isSubmitting) return false;
        if (phase === 'programado') return !!scheduledDate;
        // realizado
        if (!date || !expiry) return false;
        if (isMedical && (placeFk == null || resultFk == null)) return false;
        return true;
    })();

    const handleCreatePlace = async () => {
        const name = newPlaceName.trim();
        if (!name) { setError('El nombre del lugar es obligatorio.'); return; }
        setError(null);
        try {
            await addPlace.mutateAsync({ medical_exam_place: name });
            setPendingPlaceName(name);
            setAddingPlace(false);
            setNewPlaceName('');
        } catch (err) {
            log.error(`Error añadiendo lugar de reconocimiento: ${err}`);
        }
    };

    const buildPayload = (): MedicalPayload | ExamPayload => {
        const base = {
            person_sk: personSk!,
            date: phase === 'realizado' ? date : '',
            scheduled_date: scheduledDate,
            expiry_date: phase === 'realizado' ? expiry : '',
        };
        if (isMedical) {
            return {
                ...base,
                place_fk: placeFk ?? undefined,
                result_fk: phase === 'realizado' ? resultFk ?? undefined : undefined,
                remark,
            } satisfies MedicalPayload;
        }
        return {
            ...base,
            result: phase === 'realizado' ? resultToBool(boolResult) : undefined,
        } satisfies ExamPayload;
    };

    const handleSubmit = async () => {
        setError(null);
        if (!canSubmit) { setError('Completa los campos requeridos.'); return; }
        const payload = buildPayload();
        try {
            if ((mode === 'edit' || mode === 'complete') && initial) {
                await updateMutation.mutateAsync({ id: initial.id, ...payload });
            } else {
                const result = await createMutation.mutateAsync(payload);
                if (!result.success) { toast.error('No se pudo registrar el reconocimiento'); return; }
                toast.success(result.message);
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            log.error(`Error al guardar reconocimiento: ${err}`);
        }
    };

    return {
        cfg, isMedical, mode, isComplete,
        // estado
        personSk, setPersonSk, phase,
        scheduledDate, setScheduledDate, date, setDate,
        expiry, setExpiry: (v: string) => { setExpiryTouched(true); setExpiry(v); },
        placeFk, setPlaceFk, resultFk, setResultFk, boolResult, setBoolResult,
        remark, setRemark, error, isSubmitting, canSubmit,
        // lookups
        persons, personsLoading, places, placesLoading, results, resultsLoading,
        // sub-form lugar
        addingPlace, setAddingPlace, newPlaceName, setNewPlaceName,
        creatingPlace: addPlace.isPending, handleCreatePlace,
        // acciones
        handleSubmit,
    };
}
