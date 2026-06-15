// Estado y operaciones CRUD del diálogo de ausencias (RegisterAbsenceDialog).
// El componente queda solo con el render; toda la lógica vive aquí.

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { PermissionLevel, useHasPermission } from '@/providers';
import { usePersonsLookup } from '@/shared/hooks';
import {
    type Absence,
    type AbsenceReason,
    type DialogMode,
    type NewAbsenceData,
    type Person,
    type PersonComision,
    ADMIN_ONLY_REASONS,
    OPERATIONAL_ONLY_REASONS,
    absenceReasonColors,
    parseDate,
} from '../absences';

// Contratos con el backend (POST/PUT /absences).
interface AbsenceFormData {
    person_fk: number;
    start_date: string;
    end_date: string;
    absence_reason: string;
    remark?: string;
}

interface AbsenceInsertResult {
    absence_sk: number;
    success: boolean;
    message: string;
}

export interface UseAbsenceDialogParams {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode: DialogMode;
    persons?: Person[];
    initialData?: {
        personId?: number | '';
        startDate?: string;
        endDate?: string;
        reason?: string;
        remark?: string;
    };
    selectedAbsence?: Absence | null;
    selectedComision?: PersonComision | null;
    onCreateAbsence?: (data: NewAbsenceData) => Promise<void>;
    onUpdateAbsence?: (absence: Absence) => Promise<void>;
    onDeleteAbsence?: (absenceId: number) => Promise<void>;
    onDeleteComision?: (comisionId: number) => Promise<void>;
    onSuccess?: () => void;
}

export function useAbsenceDialog({
    open,
    onOpenChange,
    initialMode,
    persons: personsProp,
    initialData,
    selectedAbsence,
    selectedComision,
    onCreateAbsence,
    onUpdateAbsence,
    onDeleteAbsence,
    onDeleteComision,
    onSuccess,
}: UseAbsenceDialogParams) {
    const log = useLogger('RegisterAbsenceDialog');
    const [mode, setMode] = useState<DialogMode>(initialMode);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasAdministrativePermission = useHasPermission(PermissionLevel.ADMINISTRATIVO);
    const hasOperationalPermission = useHasPermission(PermissionLevel.OPERACIONAL);

    // El refresco del calendario lo hace el padre vía onSuccess → refetchAvailability
    // (la clave del calendario depende de mes/año, que viven en useDisponibilidad),
    // así que aquí no se invalida. Los errores HTTP los notifica el toast del hook.
    const createAbsence = useApiMutation<AbsenceInsertResult, AbsenceFormData>(
        'POST', '/absences', { successMessage: 'Ausencia creada correctamente.' },
    );
    const updateAbsence = useApiMutation<void, { absence_sk: number; start_date: string; end_date: string; absence_reason: string; remark?: string }>(
        'PUT', (v) => `/absences/${v.absence_sk}`,
        { successMessage: 'Ausencia actualizada correctamente.', body: ({ absence_sk, ...rest }) => rest },
    );
    const deleteAbsenceMutation = useApiMutation<void, { absence_sk: number }>(
        'DELETE', (v) => `/absences/${v.absence_sk}`, { successMessage: 'Ausencia eliminada correctamente.' },
    );
    const deleteComisionMutation = useApiMutation<void, { person_comision_sk: number }>(
        'DELETE', (v) => `/person-comisiones/${v.person_comision_sk}`, { successMessage: 'Comision eliminada correctamente.' },
    );

    // Personas: del prop si viene, si no del lookup.
    const { data: personsFromLookup, loading: lookupLoading } = usePersonsLookup();
    const persons: Person[] = personsProp && personsProp.length > 0
        ? personsProp
        : personsFromLookup.map(p => ({
            person_sk: p.person_sk,
            full_name: p.full_name,
            person_rol: '',
            escala: '',
        }));
    const personsLoading = lookupLoading && !personsProp;

    // Motivos visibles según el nivel de permiso del usuario.
    const filteredReasons: [string, AbsenceReason][] = Object.entries(absenceReasonColors).filter(([key]) => {
        if (ADMIN_ONLY_REASONS.includes(key)) return hasAdministrativePermission;
        if (OPERATIONAL_ONLY_REASONS.includes(key)) return hasOperationalPermission;
        return true;
    });

    // Estado para nueva ausencia.
    const [formData, setFormData] = useState<NewAbsenceData>({
        personId: '',
        startDate: undefined,
        endDate: undefined,
        reason: 'Permiso',
        remark: '',
    });

    // Estado para editar ausencia.
    const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
    const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
    const [editReason, setEditReason] = useState<string>('');
    const [editRemark, setEditRemark] = useState<string>('');
    const [editAbsenceSk, setEditAbsenceSk] = useState<number | null>(null);

    const clearEditState = () => {
        setEditStartDate(undefined);
        setEditEndDate(undefined);
        setEditReason('');
        setEditRemark('');
        setEditAbsenceSk(null);
    };

    /** Carga la ausencia en el formulario de edición y cambia a modo edit. */
    const startEditing = (absence: Absence) => {
        setEditStartDate(parseDate(absence.absence_start_date));
        setEditEndDate(parseDate(absence.absence_end_date));
        setEditReason(absence.absence_reason);
        setEditRemark(absence.absence_remark || '');
        setEditAbsenceSk(absence.absence_sk);
        setMode('edit');
    };

    /** Descarta la edición y vuelve al modo vista. */
    const cancelEditing = () => {
        clearEditState();
        setMode('view');
    };

    // Reset cuando cambian las props o se abre/cierra.
    useEffect(() => {
        if (!open) return;
        setMode(initialMode);

        if (initialMode === 'create') {
            setFormData({
                personId: initialData?.personId ?? '',
                startDate: parseDate(initialData?.startDate),
                endDate: parseDate(initialData?.endDate),
                reason: initialData?.reason ?? 'Permiso',
                remark: '',
            });
            clearEditState();
        } else if (initialMode === 'view' && selectedAbsence) {
            clearEditState();
        } else if (initialMode === 'edit' && selectedAbsence) {
            setEditStartDate(parseDate(selectedAbsence.absence_start_date));
            setEditEndDate(parseDate(selectedAbsence.absence_end_date));
            setEditReason(selectedAbsence.absence_reason);
            setEditRemark(selectedAbsence.absence_remark || '');
            setEditAbsenceSk(selectedAbsence.absence_sk);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialMode, initialData, selectedAbsence]);

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleCreate = async () => {
        if (!formData.personId || !formData.startDate || !formData.endDate) return;

        setIsSubmitting(true);
        try {
            const absenceData: AbsenceFormData = {
                person_fk: formData.personId as number,
                start_date: format(formData.startDate, 'yyyy-MM-dd'),
                end_date: format(formData.endDate, 'yyyy-MM-dd'),
                absence_reason: formData.reason,
                remark: formData.remark || undefined,
            };

            const result = await createAbsence.mutateAsync(absenceData);

            log.info(`Ausencia creada: ${JSON.stringify(result)}`);

            await onCreateAbsence?.(formData);
            onSuccess?.();
            handleClose();
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error creating absence: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editAbsenceSk || !editStartDate || !editEndDate) return;

        setIsSubmitting(true);
        try {
            await updateAbsence.mutateAsync({
                absence_sk: editAbsenceSk,
                start_date: format(editStartDate, 'yyyy-MM-dd'),
                end_date: format(editEndDate, 'yyyy-MM-dd'),
                absence_reason: editReason,
                remark: editRemark || undefined,
            });

            log.info(`Ausencia actualizada: id ${editAbsenceSk}`);

            if (selectedAbsence) {
                await onUpdateAbsence?.({
                    ...selectedAbsence,
                    absence_start_date: format(editStartDate, 'yyyy-MM-dd'),
                    absence_end_date: format(editEndDate, 'yyyy-MM-dd'),
                    absence_reason: editReason,
                    absence_remark: editRemark || null,
                });
            }
            onSuccess?.();
            handleClose();
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error updating absence: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAbsence = async () => {
        if (!selectedAbsence) return;

        setIsSubmitting(true);
        try {
            await deleteAbsenceMutation.mutateAsync({ absence_sk: selectedAbsence.absence_sk });

            log.info(`Ausencia eliminada: id ${selectedAbsence.absence_sk}`);

            await onDeleteAbsence?.(selectedAbsence.absence_sk);
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error deleting absence: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComision = async () => {
        if (!selectedComision) return;

        setIsSubmitting(true);
        try {
            await deleteComisionMutation.mutateAsync({ person_comision_sk: selectedComision.person_comision_sk });

            log.info(`Person comision eliminada: id ${selectedComision.person_comision_sk}`);

            await onDeleteComision?.(selectedComision.person_comision_sk);
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error deleting comision: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        // Estado general
        mode,
        isSubmitting,
        hasAdministrativePermission,

        // Personas y motivos
        persons,
        personsLoading,
        filteredReasons,

        // Formulario de alta
        formData,
        setFormData,

        // Formulario de edición
        editStartDate,
        setEditStartDate,
        editEndDate,
        setEditEndDate,
        editReason,
        setEditReason,
        editRemark,
        setEditRemark,
        editAbsenceSk,
        startEditing,
        cancelEditing,

        // Acciones
        handleClose,
        handleCreate,
        handleUpdate,
        handleDeleteAbsence,
        handleDeleteComision,
    };
}
